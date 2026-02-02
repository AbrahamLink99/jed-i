import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
    const storeDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");

    if (!clientId || !storeDomain) {
      return Response.json({ error: 'Shopify credentials not configured' }, { status: 500 });
    }

    // Get the callback URL (this function's URL with /callback suffix)
    const baseUrl = new URL(req.url).origin;
    const redirectUri = `${baseUrl}/api/functions/shopifyOAuthCallback`;

    // Shopify OAuth URL
    const scopes = 'read_orders,read_products,read_inventory';
    const authUrl = `https://${storeDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return Response.json({ 
      authUrl,
      message: 'Redirect user to this URL to authorize'
    });

  } catch (error) {
    console.error('OAuth start error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});