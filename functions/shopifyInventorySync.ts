// INTERNAL endpoint - syncs Base44 inventory to Shopify
// Requires admin authentication

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get Shopify connection
    const connections = await base44.asServiceRole.entities.ShopifyConnection.filter({ status: 'installed' });
    
    if (connections.length === 0) {
      return Response.json({ error: 'No active Shopify connection found' }, { status: 400 });
    }

    const connection = connections[0];
    const { shop_domain, access_token } = connection;

    // Get current inventory from Base44
    const inventory = await base44.asServiceRole.entities.InventorySnapshot.list();
    
    // Get Shopify products to match by SKU
    const productsResponse = await fetch(
      `https://${shop_domain}/admin/api/2024-01/products.json?limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!productsResponse.ok) {
      throw new Error(`Shopify API error: ${productsResponse.statusText}`);
    }

    const productsData = await productsResponse.json();
    const products = productsData.products || [];

    // Match and update inventory
    let updated = 0;
    let errors = 0;

    for (const product of products) {
      for (const variant of product.variants || []) {
        const sku = variant.sku;
        if (!sku) continue;

        // Find matching inventory
        const invItem = inventory.find(i => i.sku === sku);
        if (!invItem) continue;

        // Update Shopify inventory level
        const inventoryItemId = variant.inventory_item_id;
        const locationId = Deno.env.get('SHOPIFY_LOCATION_ID'); // Set this in secrets

        if (!locationId) {
          console.warn('SHOPIFY_LOCATION_ID not set, skipping inventory update');
          continue;
        }

        try {
          const updateResponse = await fetch(
            `https://${shop_domain}/admin/api/2024-01/inventory_levels/set.json`,
            {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': access_token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                location_id: parseInt(locationId),
                inventory_item_id: inventoryItemId,
                available: Math.floor(invItem.quantity_available)
              })
            }
          );

          if (updateResponse.ok) {
            updated++;
          } else {
            errors++;
            console.error(`Failed to update ${sku}:`, await updateResponse.text());
          }
        } catch (err) {
          errors++;
          console.error(`Error updating ${sku}:`, err);
        }
      }
    }

    // Update last sync timestamp
    await base44.asServiceRole.entities.ShopifyConnection.update(connection.id, {
      last_sync_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      updated,
      errors,
      total_products: products.length
    });

  } catch (error) {
    console.error('Inventory sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});