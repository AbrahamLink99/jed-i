import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');

    if (!code || !shop) {
      return Response.json({ error: 'Missing code or shop parameter' }, { status: 400 });
    }

    const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Shopify credentials not configured' }, { status: 500 });
    }

    // Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return Response.json({ error: `Token exchange failed: ${errorText}` }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Store token in a separate entity for persistence
    await base44.asServiceRole.entities.ShopifyConnection.create({
      shop,
      access_token: accessToken,
      scopes: tokenData.scope,
      connected_by: user.email,
      connected_at: new Date().toISOString()
    });

    // Redirect back to admin page with success
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/Admin?shopify_connected=true'
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});