import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// NOTE: This function calls Anthropic API. We need ANTHROPIC_API_KEY to be set.
// It builds a system prompt with current products and available mix batches, then asks the model to output ONLY JSON per the schema.

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

    // Fetch context data
    const products = await base44.entities.Product.list('-name', 1000);
    const mixBatches = await base44.entities.MixBatch.filter({ status: 'available' }, '-created_date', 200);

    const productsList = (products || []).map(p => `- ${p.sku} :: ${p.name}`).join('\n');
    const mixList = (mixBatches || []).map(m => `- ${m.batch_no} :: ${m.mix_sku} :: remaining_kg=${m.remaining_kg}`).join('\n');

    const systemPrompt = `Du är en AI-produktionsassistent i ett produktions- och lagersystem för kosmetika.\n\nDatamodell i korthet:\n- MixBatch: bulk/blandning producerad i kilogram (kg) med fält: mix_sku, batch_no, produced_kg, remaining_kg.\n- Batch: färdigvara producerad i styck med fält: batch_number, product_sku, produced_quantity.\n- InventoryLedger: lagertransaktioner. Vi registrerar 'production' (ökning) och 'backflush' (förbrukning).\n\nAktuella produkter (SKU :: namn):\n${productsList}\n\nTillgängliga MixBatches (batch_no :: mix_sku :: remaining_kg):\n${mixList || '- inga'}\n\nUppgift: Tolka användarens fritext om genomförd produktion. Matcha ALLA varubeskrivningar till SKU från listan ovan (t.ex. 'hårmask bas' -> korrekt SKU). Om tveksamhet, välj bästa SKU baserat på namnlikhet.\n\nUtdata: Svara ENDAST med ren JSON (ingen markdown) enligt detta schema:\n{\n  "summary": "Förklarande text till användaren på svenska",\n  "actions": [\n    { "type": "mix_batch", "sku": "...", "kg": 600, "batch_no": "..." },\n    { "type": "finished_batch", "sku": "...", "units": 412, "batch_no": "..." }\n  ]\n}\n\nViktigt:\n- Svara endast med giltig JSON.\n- Använd exakta SKU från produktlistan.\n- Ange batch_no om användaren nämner den, annars föreslå ett rimligt kort värde (ex. HM-202403-01).`;

    const payload = {
      model: 'claude-sonnet-4-20250514',
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ],
      max_tokens: 800,
      temperature: 0.2,
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
    try {
      // Anthropic messages API returns content array
      text = (data?.content?.[0]?.text || '').trim();
    } catch (_) {
      text = '';
    }

    // Ensure pure JSON (no markdown). Some models may wrap with ```json ... ```
    const cleaned = text.replace(/^```json\n?|```$/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Fallback: guide user
      parsed = {
        summary: 'Jag kunde inte tolka meddelandet. Jag kan hjälpa dig att registrera blandningar (kg) och färdigvarubatcher (st). Ex: "Körde 600 kg Hårmask bas, fick ut 412 st 350ml och 198 st 50ml, spill 2 kg".',
        actions: []
      };
    }

    return Response.json(parsed);
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});