// PUBLIC endpoint - no Base44 auth required
// Initiates Shopify OAuth flow

Deno.serve(async (req) => {
  try {
    // Get shop from query params (for direct browser calls)
    const url = new URL(req.url);
    let shop = url.searchParams.get('shop');
    
    // If not in query, try request body (for API calls)
    if (!shop && req.method === 'POST') {
      try {
        const body = await req.json();
        shop = body.shop;
      } catch (e) {
        // Body parsing failed, continue without it
      }
    }

    if (!shop) {
      return Response.json({ error: 'Missing shop parameter' }, { status: 400 });
    }

    // Validate shop domain
    if (!shop.endsWith('.myshopify.com')) {
      return Response.json({ error: 'Invalid shop domain' }, { status: 400 });
    }

    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    
    if (!clientId) {
      return Response.json({ error: 'Shopify client ID not configured' }, { status: 500 });
    }
    
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
    // Return HTML error page for better user experience
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: sans-serif; padding: 50px; text-align: center;">
        <h1>OAuth Error</h1>
        <p style="color: red;">${error.message}</p>
        <a href="https://jed-i.base44.app/Admin">Return to Admin</a>
      </body>
      </html>
    `, { 
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
});