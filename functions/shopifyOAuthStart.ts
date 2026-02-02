// PUBLIC endpoint - no Base44 auth required
// Initiates Shopify OAuth flow

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const shop = url.searchParams.get('shop');

    if (!shop) {
      return Response.json({ error: 'Missing shop parameter' }, { status: 400 });
    }

    // Validate shop domain
    if (!shop.endsWith('.myshopify.com')) {
      return Response.json({ error: 'Invalid shop domain' }, { status: 400 });
    }

    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const redirectUri = 'https://jed-i.base44.app/api/functions/shopifyOAuthCallback';
    const scopes = 'read_products,write_inventory,read_inventory,read_orders';
    
    // Generate state for CSRF protection
    const state = crypto.randomUUID();

    // Build Shopify OAuth URL
    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    // Redirect to Shopify
    return Response.redirect(authUrl.toString(), 302);

  } catch (error) {
    console.error('OAuth start error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});