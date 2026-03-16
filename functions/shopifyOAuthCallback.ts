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

    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!clientSecret) {
      return Response.json({ error: 'SHOPIFY_CLIENT_SECRET not set' }, { status: 500 });
    }

    // Exchange code for access token
    const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('SHOPIFY_CLIENT_ID'),
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return Response.json({ error: `Token exchange failed: ${text}` }, { status: 400 });
    }

    const { access_token, scope } = await tokenRes.json();

    return Response.json({ access_token, scope });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});