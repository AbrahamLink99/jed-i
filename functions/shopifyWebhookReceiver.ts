// PUBLIC endpoint - receives Shopify webhooks
// No Base44 auth required, validates Shopify HMAC

import { createClient } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Validate Shopify HMAC
    const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256');
    const topic = req.headers.get('X-Shopify-Topic');
    const shop = req.headers.get('X-Shopify-Shop-Domain');

    if (!hmacHeader || !topic || !shop) {
      return Response.json({ error: 'Invalid webhook headers' }, { status: 401 });
    }

    const body = await req.text();
    
    // Verify HMAC
    const secret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));

    if (computedHmac !== hmacHeader) {
      return Response.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // Parse webhook data
    const data = JSON.parse(body);
    
    // Initialize Base44 client with service role
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      { serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY') }
    );

    // Handle different webhook topics
    switch (topic) {
      case 'orders/create':
      case 'orders/updated':
        // Log order for processing
        console.log(`Order ${topic}:`, data.id, data.name);
        // TODO: Process order and update inventory
        break;

      case 'products/create':
      case 'products/update':
        // Log product changes
        console.log(`Product ${topic}:`, data.id, data.title);
        break;

      case 'app/uninstalled':
        // Mark connection as revoked
        await base44.entities.ShopifyConnection.filter({ shop_domain: shop }).then(conns => {
          if (conns.length > 0) {
            return base44.entities.ShopifyConnection.update(conns[0].id, { status: 'revoked' });
          }
        });
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('Webhook receiver error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});