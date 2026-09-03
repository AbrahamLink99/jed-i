import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const message = String(body?.message || '').trim();
    if (!message) {
      return Response.json({ error: 'Missing message' }, { status: 400 });
    }

    // Fetch data in parallel
    const [products, bomItems, mixBatchesAvail, alerts, ledger, batchesAvail, packagingRecipes] = await Promise.all([
      base44.entities.Product.filter({ environment: 'production' }, '-name', 2000),
      base44.entities.BOMItem.list(undefined, 5000),
      base44.entities.MixBatch.filter({ status: 'available', environment: 'production' }, '-created_date', 1000),
      base44.entities.InventoryAlert.filter({ status: ['OPEN', 'ORDERED_ACKNOWLEDGED'], environment: 'production' }, '-last_evaluated_at', 1000),
      base44.entities.InventoryLedger.filter({ environment: 'production' }, '-created_date', 50000),
      base44.entities.Batch.filter({ status: 'available', environment: 'production' }, '-created_date', 1000),
      base44.entities.PackagingRecipe.filter({ environment: 'production' }, '-created_date', 2000).catch(() => [])
    ]);

    const productById = new Map((products || []).map(p => [p.id, p]));

    const productsPayload = (products || []).map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      type: p.type,
      unit: p.unit,
      safety_stock: p.safety_stock ?? null,
      reorder_point: p.reorder_point ?? null,
      supplier: p.supplier ?? null,
      unlimited_stock: !!p.unlimited_stock
    }));

    const bomPayload = (bomItems || []).map(b => ({
      finished_product_id: b.finished_product_id,
      component_id: b.component_id,
      component_sku: productById.get(b.component_id)?.sku || null,
      component_name: productById.get(b.component_id)?.name || null,
      quantity_per_unit: b.quantity_per_unit
    }));

    const mixPayload = (mixBatchesAvail || []).map(m => ({
      mix_sku: m.mix_sku,
      batch_no: m.batch_no,
      produced_kg: m.produced_kg,
      remaining_kg: m.remaining_kg,
      produced_at: m.produced_at
    }));

    const alertsPayload = (alerts || []).map(a => {
      const ca = Number(a.current_available_qty);
      const ss = Number(a.safety_stock);
      const valid = Number.isFinite(ca) && Number.isFinite(ss);
      const gap = valid ? (ss - ca) : null;
      const needs_ordering = valid ? (ca < ss) : false;
      return {
        product_sku: a.product_sku,
        product_name: a.product_name,
        type: a.type,
        severity: a.severity,
        current_available_qty: a.current_available_qty,
        safety_stock: a.safety_stock,
        suggested_order_qty: a.suggested_order_qty,
        deprioritized_reason: a.deprioritized_reason || null,
        needs_ordering,
        gap
      };
    });

    const ledgerPayload = (ledger || []).map(l => ({
      product_sku: l.product_sku,
      transaction_type: l.transaction_type,
      quantity: l.quantity,
      created_date: l.created_date
    }));

    // Compute real-time availability per SKU from ledger (on-hand minus net reservations)
    const availSums = new Map();
    for (const l of (ledger || [])) {
      const sku = l.product_sku; if (!sku) continue;
      const rec = availSums.get(sku) || { onhand: 0, reserved: 0 };
      const qty = Number(l.quantity) || 0;
      if (l.transaction_type === 'reservation' || l.transaction_type === 'release_reservation') {
        rec.reserved += qty;
      } else {
        rec.onhand += qty;
      }
      availSums.set(sku, rec);
    }
    const computedAvailability = Array.from(availSums.entries()).map(([sku, r]) => ({ product_sku: sku, available_qty: (r.onhand - r.reserved) }));

    const batchesPayload = (batchesAvail || []).map(b => ({
      product_sku: b.product_sku,
      product_name: b.product_name,
      current_quantity: b.current_quantity,
      batch_number: b.batch_number
    }));

    const recipesPayload = (packagingRecipes || []).map(r => ({
      mix_sku: r.mix_sku,
      finished_sku: r.finished_sku,
      finished_name: r.finished_name,
      fill_ml_per_unit: r.fill_ml_per_unit,
      components: r.components
    }));

    const systemContext = [
      'Du är en intelligent assistent för ett kosmetika-produktionssystem kallat Lagermaster.',
      'Du har tillgång till realtidsdata från systemet och kan svara på alla frågor om lager,',
      'produktion, inköp och planering. Du kan också registrera genomförd produktion när användaren',
      'beskriver vad som faktiskt har hänt. Svara alltid på svenska och var konkret och handlingsorienterad.',
      '',
      'AKTUELL SYSTEMDATA:',
      'Produkter: ' + JSON.stringify(productsPayload),
      'BOM-recept: ' + JSON.stringify(bomPayload),
      'Tillgängliga blandningar: ' + JSON.stringify(mixPayload),
      'Aktiva notiser: ' + JSON.stringify(alertsPayload),
      'Senaste transaktioner: ' + JSON.stringify(ledgerPayload),
      'Tillgängliga färdigvarubatcher: ' + JSON.stringify(batchesPayload),
      (recipesPayload?.length ? ('PackagingRecipe: ' + JSON.stringify(recipesPayload)) : 'PackagingRecipe: []'),
      'Beräknad tillgänglighet: ' + JSON.stringify(computedAvailability),
      '',
      'Instruktion för svar:',
      '- Avgör intent i användarens meddelande.',
      '- Svara med {"type":"production",...} ENDAST när användaren beskriver genomförd produktion med konkreta siffror (kg, st, batchnummer).',
      '- För ALLA frågor, analyser, listor och rapporter: svara med {"type":"info","summary":"...","tables":[...]} (tables valfritt).',
      '- För inköpslista/beställning/under säkerhetslager: använd "Beräknad tillgänglighet" som primär källa (fallback till alerts.current_available_qty). Räkna Tillgängligt per SKU, jämför mot product.safety_stock. Föreslagen beställning = max(0, safety_stock - tillgängligt), men om alerts.suggested_order_qty är större – använd det. Inkludera ENDAST artiklar där alerts.needs_ordering === true (dvs current_available_qty < safety_stock). Exempel: 899 kg i lager och säkerhetslager 50 kg ska ALDRIG inkluderas i inköpslistan. Bygg tabell: ["Leverantör","SKU","Namn","Tillgängligt","Säkerhetslager","Föreslagen beställning"]. Stöd filtrering/gruppering per leverantör och hantera frasen "samma leverantör" genom att välja den leverantör som förekommer mest i urvalet.',
      '- Svara ENDAST med giltig JSON utan markdown eller extra text.'
    ].join('\n');

    const payload = {
      model: 'claude-sonnet-4-20250514',
      system: systemContext,
      messages: [ { role: 'user', content: message } ],
      max_tokens: 1500,
      temperature: 0.2
    };

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return Response.json({ error: 'Anthropic error', details: errTxt }, { status: 500 });
    }

    const data = await resp.json();
    let text = '';
    try { text = (data?.content?.[0]?.text || '').trim(); } catch (_) { text = ''; }

    const cleaned = text.replace(/^```json\n?|```$/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parsed = {
        type: 'info',
        summary: 'Jag kunde inte tolka meddelandet. Beskriv produktion (t.ex. "Körde 600 kg ...") eller ställ en fråga om lager/planering.',
        tables: []
      };
    }

    // Minimal normalization
    if (!parsed.type) {
      parsed.type = Array.isArray(parsed.actions) && parsed.actions.length ? 'production' : 'info';
    }

    return Response.json(parsed);
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});