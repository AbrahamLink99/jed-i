import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch datasets in parallel
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      openAlertsAll,
      bomItemsAll,
      ledgerAll,
      mixBatchesAll,
      productsAll
    ] = await Promise.all([
      base44.entities.InventoryAlert.filter({ status: 'OPEN', environment: 'production' }, '-last_evaluated_at', 2000),
      base44.entities.BOMItem.list(undefined, 5000),
      base44.entities.InventoryLedger.filter({ environment: 'production' }, '-created_date', 50000),
      base44.entities.MixBatch.filter({ environment: 'production' }, '-created_date', 2000),
      base44.entities.Product.filter({ environment: 'production' }, '-name', 5000),
    ]);

    const productById = new Map((productsAll || []).map(p => [p.id, p]));
    const productBySku = new Map((productsAll || []).map(p => [p.sku, p]));

    // Prepare datasets as required
    const openAlerts = (openAlertsAll || []).map(a => ({
      product_sku: a.product_sku,
      product_name: a.product_name,
      type: a.type,
      current_available_qty: Number(a.current_available_qty ?? 0),
      safety_stock: Number(a.safety_stock ?? 0),
      suggested_order_qty: Number(a.suggested_order_qty ?? 0),
      supplier: a.supplier || productBySku.get(a.product_sku)?.supplier || null,
      unit: productBySku.get(a.product_sku)?.unit || null
    }));

    const bomItems = (bomItemsAll || []).map(b => ({
      finished_product_id: b.finished_product_id,
      component_id: b.component_id,
      component_sku: productById.get(b.component_id)?.sku || null,
      component_name: productById.get(b.component_id)?.name || null,
      quantity_per_unit: Number(b.quantity_per_unit ?? 0)
    }));

    const shipments_last_30_days = (ledgerAll || [])
      .filter(l => l.transaction_type === 'shipment')
      .filter(l => {
        try { return new Date(l.created_date) >= since; } catch { return false; }
      })
      .map(l => ({
        product_sku: l.product_sku,
        quantity: Number(l.quantity ?? 0),
        created_date: l.created_date
      }));

    const mix_batches = (mixBatchesAll || [])
      .filter(m => Number(m.remaining_kg ?? 0) > 0)
      .map(m => ({
        mix_sku: m.mix_sku,
        batch_no: m.batch_no,
        remaining_kg: Number(m.remaining_kg ?? 0),
        produced_at: m.produced_at
      }));

    const dataPayload = {
      open_alerts,
      bom_items: bomItems,
      shipments_last_30_days,
      mix_batches,
      products: (productsAll || []).map(p => ({ sku: p.sku, name: p.name, unit: p.unit, supplier: p.supplier, type: p.type }))
    };

    const systemPrompt = [
      'Du är en produktionsplanerare för ett kosmetika-tillverkningsföretag. Analysera lagerstatus, försäljningshistorik och BOM-recept och ge konkreta rekommendationer för denna vecka.',
      'produce_this_week = färdigvaror som är låga i lager baserat på försäljningstakt.',
      'order_now = råvaror under säkerhetslager grupperade per leverantör.',
      'order_soon = råvaror som inte är slut än men som behövs för att kunna tillverka produce_this_week-produkterna – inkludera vilken produkt de är kopplade till via connected_to.',
      'insights = en kort mening med det viktigaste att tänka på denna vecka.',
      'Svara ENDAST med JSON enligt EXAKT följande format utan markdown eller extra text:',
      '{"produce_this_week":[{"sku":"","name":"","reason":""}],',
      ' "order_now":[{"supplier":"","items":[{"sku":"","name":"","qty":"","unit":""}],"reason":""}],',
      ' "order_soon":[{"supplier":"","items":[{"sku":"","name":"","qty":"","unit":""}],"reason":"","connected_to":""}],',
      ' "insights":""}'
    ].join(' ');

    const userMessage = [
      'DATA (JSON):',
      JSON.stringify(dataPayload)
    ].join('\n');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }

    const payload = {
      model: 'claude-3-5-sonnet-20240620',
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 2000,
      temperature: 0.2
    };

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
      const errText = await resp.text();
      return Response.json({ error: 'Anthropic error', details: errText }, { status: 500 });
    }

    const data = await resp.json();
    let text = '';
    try { text = (data?.content?.[0]?.text || '').trim(); } catch { text = ''; }
    const cleaned = text.replace(/^```json\n?|```$/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return Response.json({ error: 'Failed to parse AI JSON', raw: cleaned }, { status: 500 });
    }

    return Response.json(parsed);
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});