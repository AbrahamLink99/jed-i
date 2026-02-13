import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mix_batch_id, lines, waste, bulk_waste_kg } = await req.json();

    if (!mix_batch_id || !lines) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get the mix batch
    const mixBatch = await base44.entities.MixBatch.get(mix_batch_id);
    if (!mixBatch) {
      return Response.json({ error: 'Mix batch not found' }, { status: 404 });
    }

    // Get packaging recipes for this mix
    const recipes = await base44.entities.PackagingRecipe.filter({
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
      if (!recipe) continue;
      
      const fill_liters = (recipe.fill_ml_per_unit * line.produced_units) / 1000;
      bulk_used_kg += fill_liters;
    }

    // Calculate components usage
    const componentsMap = {};
    
    for (const line of lines) {
      const recipe = recipesMap[line.finished_sku];
      if (!recipe) continue;
      
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

    // Add waste to components
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

    // Check for warnings
    const warnings = [];
    
    if (remaining_kg_after < 0) {
      warnings.push({
        type: 'error',
        message: `Inte tillräckligt med bulk! Behöver ${bulk_used_kg.toFixed(2)} kg, men endast ${mixBatch.remaining_kg.toFixed(2)} kg finns kvar.`
      });
    }

    // Check component availability
    for (const comp of components_used) {
      const product = await base44.entities.Product.filter({ sku: comp.component_sku });
      if (product.length === 0) {
        warnings.push({
          type: 'warning',
          message: `Komponent ${comp.component_sku} finns inte i systemet`
        });
        continue;
      }

      // Calculate available stock
      const ledger = await base44.entities.InventoryLedger.filter({ product_sku: comp.component_sku });
      const available = ledger.reduce((sum, entry) => sum + entry.quantity, 0);
      
      if (available < comp.qty_used) {
        warnings.push({
          type: 'warning',
          message: `Lagerbrist: ${comp.component_name} - Behöver ${comp.qty_used}, finns ${available.toFixed(0)}`
        });
      }
    }

    return Response.json({
      bulk_used_kg: parseFloat(bulk_used_kg.toFixed(3)),
      components_used,
      remaining_kg_after: parseFloat(remaining_kg_after.toFixed(3)),
      warnings
    });

  } catch (error) {
    console.error('Preview error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});