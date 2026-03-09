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
      base44.entities.InventoryAlert.filter({ status: 'OPEN', environment: 'production' }, '-last_evaluated_at', 200),
      base44.entities.BOMItem.list(undefined, 200),
      base44.entities.InventoryLedger.filter({ environment: 'production' }, '-created_date', 100),
      base44.entities.MixBatch.filter({ environment: 'production' }, '-created_date', 100),
      base44.entities.Product.filter({ environment: 'production' }, '-name', 1000),
    ]);

    const productById = new Map((productsAll || []).map(p => [p.id, p]));
    const productBySku = new Map((productsAll || []).map(p => [p.sku, p]));

    // Severity sort order: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const openAlertsSorted = (openAlertsAll || [])
      .sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))
      .slice(0, 50);

    // Build compact text summaries instead of full JSON objects
    const alertsSummary = openAlertsSorted.slice(0, 30).map(a => {
      const supplier = a.supplier || productBySku.get(a.product_sku)?.supplier || 'okänd';
      const unit = productBySku.get(a.product_sku)?.unit || '';
      return `${a.product_sku} ${a.product_name}: ${Number(a.current_available_qty ?? 0)} ${unit} (säkerhetslager: ${Number(a.safety_stock ?? 0)}, leverantör: ${supplier})`;
    }).join('\n');

    const bomSummary = (bomItemsAll || []).slice(0, 40).map(b => {
      const compSku = productById.get(b.component_id)?.sku || b.component_id;
      const finSku = productById.get(b.finished_product_id)?.sku || b.finished_product_id;
      return `${finSku} innehåller ${compSku} (${Number(b.quantity_per_unit ?? 0)} kg/kg)`;
    }).join('\n');

    const shipmentsSummary = (ledgerAll || [])
      .filter(l => l.transaction_type === 'shipment')
      .filter(l => { try { return new Date(l.created_date) >= since; } catch { return false; } })
      .slice(0, 30)
      .map(l => `${l.product_sku}: ${Number(l.quantity ?? 0)} st`)
      .join('\n');

    const mixSummary = (mixBatchesAll || [])
      .filter(m => Number(m.remaining_kg ?? 0) > 0)
      .slice(0, 20)
      .map(m => `${m.mix_sku} batch ${m.batch_no}: ${Number(m.remaining_kg ?? 0)} kg kvar`)
      .join('\n');

    const systemPrompt = 'Du är en produktionsplanerare för ett kosmetika-tillverkningsföretag. Analysera lagerstatus och ge konkreta rekommendationer. produce_this_week=färdigvaror låga i lager. order_now=råvaror under säkerhetslager per leverantör. order_soon=råvaror som behövs för produce_this_week (connected_to=vilken produkt). insights=en kort mening. Svara ENDAST med JSON utan markdown: {"produce_this_week":[{"sku":"","name":"","reason":""}],"order_now":[{"supplier":"","items":[{"sku":"","name":"","qty":"","unit":""}],"reason":""}],"order_soon":[{"supplier":"","items":[{"sku":"","name":"","qty":"","unit":""}],"reason":"","connected_to":""}],"insights":""}';

    const userMessage = [
      'NOTISER (sku namn: tillgängligt enhet, säkerhetslager, leverantör):',
      alertsSummary || 'Inga öppna notiser.',
      '\nBOM-RECEPT (färdigvara innehåller komponent kg/kg):',
      bomSummary || 'Inga BOM-rader.',
      '\nFÖRSÄLJNING SENASTE 30 DAGARNA:',
      shipmentsSummary || 'Ingen data.',
      '\nAKTIVA MIXBATCHER:',
      mixSummary || 'Inga aktiva batcher.'
    ].join('\n');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }

    const payload = {
      model: 'claude-haiku-4-5-20251001',
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 1500,
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
      console.error('Anthropic error:', errText);
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