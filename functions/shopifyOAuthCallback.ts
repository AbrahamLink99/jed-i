// PUBLIC endpoint - no Base44 auth required
// Handles Shopify OAuth callback and stores connection

import { createClient } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');
    const state = url.searchParams.get('state');

    if (!code || !shop) {
      return new Response('Missing required parameters', { status: 400 });
    }

    // Exchange code for access token
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, scope } = tokenData;

    // Store connection in Base44 (using service role)
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      { serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY') }
    );

    // Check if connection exists
    const existing = await base44.entities.ShopifyConnection.filter({ shop_domain: shop });
    
    if (existing.length > 0) {
      // Update existing
      await base44.entities.ShopifyConnection.update(existing[0].id, {
        access_token: access_token,
        scopes: scope,
        installed_at: new Date().toISOString(),
        status: 'installed'
      });
    } else {
      // Create new
      await base44.entities.ShopifyConnection.create({
        shop_domain: shop,
        access_token: access_token,
        scopes: scope,
        installed_at: new Date().toISOString(),
        status: 'installed'
      });
    }

    // Redirect back to Base44 admin page
    return Response.redirect('https://jed-i.base44.app/Admin?shopify=connected', 302);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});