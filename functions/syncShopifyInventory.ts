import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Calculate available stock for a product
function calculateAvailableStock(ledgerEntries, productBuffer = 0) {
    let onHand = 0;
    let reserved = 0;
    
    for (const entry of ledgerEntries) {
        const qty = entry.quantity || 0;
        
        if (['inbound', 'production', 'adjustment'].includes(entry.transaction_type)) {
            onHand += qty;
        } else if (entry.transaction_type === 'reservation') {
            reserved += Math.abs(qty);
        } else if (entry.transaction_type === 'release_reservation') {
            reserved -= qty;
        } else if (['pick', 'shipment', 'scrap', 'backflush'].includes(entry.transaction_type)) {
            onHand += qty; // These are typically negative
        }
    }
    
    const available = Math.max(0, onHand - reserved - productBuffer);
    return Math.floor(available);
}

// Sync inventory to Shopify
async function syncToShopify(shopDomain, accessToken, locationId, variantId, inventoryItemId, quantity) {
    const url = `https://${shopDomain}/admin/api/2024-01/inventory_levels/set.json`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available: quantity
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Shopify API error: ${error}`);
    }
    
    return await response.json();
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Check admin access
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }
        
        const { sku, store_id } = await req.json();
        
        // Get store credentials
        const storePrefix = store_id === 'b2c' ? 'SHOPIFY_B2C' : 'SHOPIFY_B2B';
        const shopDomain = Deno.env.get(`${storePrefix}_SHOP_DOMAIN`);
        const accessToken = Deno.env.get(`${storePrefix}_ACCESS_TOKEN`);
        const locationId = Deno.env.get(`${storePrefix}_LOCATION_ID`);
        
        if (!shopDomain || !accessToken) {
            return Response.json({ 
                error: `Missing credentials for ${store_id} store` 
            }, { status: 400 });
        }
        
        // Get product and mappings
        const products = await base44.asServiceRole.entities.Product.filter({ sku });
        if (products.length === 0) {
            return Response.json({ error: 'Product not found' }, { status: 404 });
        }
        
        const product = products[0];
        
        // Get Shopify variant mapping
        const mappings = await base44.asServiceRole.entities.ShopifyVariantMapping.filter({
            sku: sku,
            store_id: store_id,
            sync_enabled: true
        });
        
        if (mappings.length === 0) {
            return Response.json({ 
                error: 'No active Shopify mapping found for this SKU and store' 
            }, { status: 404 });
        }
        
        const mapping = mappings[0];
        
        // Get all ledger entries for this product
        const ledgerEntries = await base44.asServiceRole.entities.InventoryLedger.filter({
            product_id: product.id
        });
        
        // Calculate available stock
        const availableQty = calculateAvailableStock(ledgerEntries, product.shopify_buffer || 0);
        
        // Sync to Shopify
        const result = await syncToShopify(
            shopDomain,
            accessToken,
            locationId || mapping.shopify_location_id,
            mapping.shopify_variant_id,
            mapping.shopify_inventory_item_id,
            availableQty
        );
        
        // Update mapping record
        await base44.asServiceRole.entities.ShopifyVariantMapping.update(mapping.id, {
            last_synced_qty: availableQty,
            last_sync_at: new Date().toISOString()
        });
        
        return Response.json({
            success: true,
            sku: sku,
            store_id: store_id,
            synced_quantity: availableQty,
            shopify_response: result
        });
        
    } catch (error) {
        console.error('Sync error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});