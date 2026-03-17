import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SHOP = 'brunsprofessional.myshopify.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { code } = body;

    if (!code) {
      return Response.json({ error: 'Missing code' }, { status: 400 });
    }

    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return Response.json({ error: 'SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET not set' }, { status: 500 });
    }

    console.log('=== SHOPIFY TOKEN EXCHANGE DEBUG ===');
    console.log('SHOP:', SHOP);
    console.log('client_id:', clientId);
    console.log('client_secret length:', clientSecret?.length, '| first 4 chars:', clientSecret?.slice(0, 4));
    console.log('code:', code);
    console.log('code length:', code?.length);

    const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const responseText = await tokenRes.text();

    if (!tokenRes.ok) {
      return Response.json({ error: `Token exchange failed (${tokenRes.status}): ${responseText}` }, { status: 400 });
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch {
      return Response.json({ error: `Invalid JSON from Shopify: ${responseText}` }, { status: 500 });
    }

    if (tokenData.error) {
      return Response.json({ error: tokenData.error_description || tokenData.error }, { status: 400 });
    }

    return Response.json({
      access_token: tokenData.access_token,
      scope: tokenData.scope,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});