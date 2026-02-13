import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mix_batch_id, lines, waste, bulk_waste_kg } = await req.json();

    if (!mix_batch_id || !lines || lines.length === 0) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get the mix batch
    const mixBatch = await base44.asServiceRole.entities.MixBatch.get(mix_batch_id);
    if (!mixBatch) {
      return Response.json({ error: 'Mix batch not found' }, { status: 404 });
    }

    if (mixBatch.status !== 'available') {
      return Response.json({ error: 'Batch is not available' }, { status: 400 });
    }

    // Get packaging recipes
    const recipes = await base44.asServiceRole.entities.PackagingRecipe.filter({
      mix_sku: mixBatch.mix_sku,
      active: true
    });

    const recipesMap = {};
    recipes.forEach(r => {
      recipesMap[r.finished_sku] = r;
    });

    // Calculate bulk usage
    let bulk_used_kg = (bulk_waste_kg || 0);
    
    for (const line of lines) {
      const recipe = recipesMap[line.finished_sku];
      if (!recipe) {
        return Response.json({ error: `Recipe not found for ${line.finished_sku}` }, { status: 400 });
      }
      
      const fill_liters = (recipe.fill_ml_per_unit * line.produced_units) / 1000;
      bulk_used_kg += fill_liters;
    }

    // Calculate components usage
    const componentsMap = {};
    
    for (const line of lines) {
      const recipe = recipesMap[line.finished_sku];
      
      for (const comp of recipe.components) {
        if (!componentsMap[comp.component_sku]) {
          componentsMap[comp.component_sku] = {
            component_sku: comp.component_sku,
            component_name: comp.component_name,
            qty_used: 0
          };
        }
        componentsMap[comp.component_sku].qty_used += comp.qty_per_unit * line.produced_units;
      }
    }

    // Add waste
    if (waste) {
      for (const w of waste) {
        if (!componentsMap[w.component_sku]) {
          componentsMap[w.component_sku] = {
            component_sku: w.component_sku,
            component_name: w.component_name || w.component_sku,
            qty_used: 0
          };
        }
        componentsMap[w.component_sku].qty_used += w.waste_qty;
      }
    }

    const components_used = Object.values(componentsMap);
    const remaining_kg_after = mixBatch.remaining_kg - bulk_used_kg;

    // Validate
    if (remaining_kg_after < 0) {
      return Response.json({ 
        error: `Inte tillräckligt med bulk! Behöver ${bulk_used_kg.toFixed(2)} kg, men endast ${mixBatch.remaining_kg.toFixed(2)} kg finns kvar.` 
      }, { status: 400 });
    }

    // Update mix batch
    await base44.asServiceRole.entities.MixBatch.update(mix_batch_id, {
      remaining_kg: remaining_kg_after,
      status: remaining_kg_after <= 0 ? 'depleted' : 'available'
    });

    // Create inventory ledger entries
    const ledgerEntries = [];

    // Deduct bulk from mix batch
    ledgerEntries.push({
      product_sku: mixBatch.mix_sku,
      transaction_type: 'backflush',
      quantity: -bulk_used_kg,
      reference_type: 'filling_report',
      reference_id: mix_batch_id,
      notes: `Tappning från batch ${mixBatch.batch_no}`,
      environment: mixBatch.environment
    });

    // Add finished goods
    for (const line of lines) {
      const recipe = recipesMap[line.finished_sku];
      ledgerEntries.push({
        product_sku: line.finished_sku,
        product_name: recipe.finished_name,
        transaction_type: 'production',
        quantity: line.produced_units,
        reference_type: 'filling_report',
        reference_id: mix_batch_id,
        notes: `Tappning från batch ${mixBatch.batch_no}`,
        environment: mixBatch.environment
      });
    }

    // Deduct components
    for (const comp of components_used) {
      ledgerEntries.push({
        product_sku: comp.component_sku,
        product_name: comp.component_name,
        transaction_type: 'backflush',
        quantity: -comp.qty_used,
        reference_type: 'filling_report',
        reference_id: mix_batch_id,
        notes: `Tappning från batch ${mixBatch.batch_no}`,
        environment: mixBatch.environment
      });
    }

    await base44.asServiceRole.entities.InventoryLedger.bulkCreate(ledgerEntries);

    // Create filling report
    const reportData = {
      mix_batch_id,
      mix_sku: mixBatch.mix_sku,
      batch_no: mixBatch.batch_no,
      lines: lines.map(l => ({
        finished_sku: l.finished_sku,
        finished_name: recipesMap[l.finished_sku].finished_name,
        produced_units: l.produced_units
      })),
      waste: waste || [],
      bulk_waste_kg: bulk_waste_kg || 0,
      bulk_used_kg: parseFloat(bulk_used_kg.toFixed(3)),
      components_used,
      remaining_kg_after: parseFloat(remaining_kg_after.toFixed(3)),
      environment: mixBatch.environment
    };

    const report = await base44.asServiceRole.entities.FillingReport.create(reportData);

    return Response.json({
      success: true,
      report,
      receipt: {
        batch_no: mixBatch.batch_no,
        total_units: lines.reduce((sum, l) => sum + l.produced_units, 0),
        bulk_used_kg: parseFloat(bulk_used_kg.toFixed(3)),
        remaining_kg: parseFloat(remaining_kg_after.toFixed(3)),
        lines: reportData.lines,
        components_used
      }
    });

  } catch (error) {
    console.error('Complete filling error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});