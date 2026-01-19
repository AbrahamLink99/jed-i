import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

// Verify Shopify webhook signature
function verifyWebhook(body, hmacHeader, secret) {
    const hash = createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');
    return hash === hmacHeader;
}

// Get store config based on shop domain
function getStoreConfig(shopDomain) {
    const b2cDomain = Deno.env.get('SHOPIFY_B2C_SHOP_DOMAIN');
    const b2bDomain = Deno.env.get('SHOPIFY_B2B_SHOP_DOMAIN');
    
    if (shopDomain.includes(b2cDomain)) {
        return {
            storeId: 'b2c',
            secret: Deno.env.get('SHOPIFY_B2C_WEBHOOK_SECRET')
        };
    } else if (b2bDomain && shopDomain.includes(b2bDomain)) {
        return {
            storeId: 'b2b',
            secret: Deno.env.get('SHOPIFY_B2B_WEBHOOK_SECRET')
        };
    }
    return null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get webhook headers
        const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256');
        const topic = req.headers.get('X-Shopify-Topic');
        const shopDomain = req.headers.get('X-Shopify-Shop-Domain');
        
        if (!hmacHeader || !topic || !shopDomain) {
            return Response.json({ error: 'Missing required headers' }, { status: 400 });
        }
        
        // Get store config
        const storeConfig = getStoreConfig(shopDomain);
        if (!storeConfig) {
            return Response.json({ error: 'Unknown shop domain' }, { status: 400 });
        }
        
        // Read body
        const body = await req.text();
        
        // Verify webhook signature
        if (!verifyWebhook(body, hmacHeader, storeConfig.secret)) {
            return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }
        
        // Parse webhook data
        const webhookData = JSON.parse(body);
        
        // Handle different webhook topics
        switch (topic) {
            case 'orders/create':
                await handleOrderCreate(base44, webhookData, storeConfig.storeId);
                break;
                
            case 'orders/cancelled':
                await handleOrderCancelled(base44, webhookData, storeConfig.storeId);
                break;
                
            case 'orders/fulfilled':
                await handleOrderFulfilled(base44, webhookData, storeConfig.storeId);
                break;
                
            default:
                console.log(`Unhandled webhook topic: ${topic}`);
        }
        
        return Response.json({ success: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function handleOrderCreate(base44, order, storeId) {
    // Create ShopifyOrderRef
    const orderRef = await base44.asServiceRole.entities.ShopifyOrderRef.create({
        store_id: storeId,
        shopify_order_id: order.id.toString(),
        shopify_order_number: order.name || order.order_number?.toString(),
        order_created_at: order.created_at,
        status: 'pending',
        total_items: order.line_items?.length || 0,
        mirrored_at: new Date().toISOString()
    });
    
    // Create ShopifyOrderLineRef for each line item
    for (const lineItem of order.line_items || []) {
        const sku = lineItem.sku;
        if (!sku) continue;
        
        await base44.asServiceRole.entities.ShopifyOrderLineRef.create({
            shopify_order_id: order.id.toString(),
            shopify_order_ref_id: orderRef.id,
            shopify_order_number: order.name || order.order_number?.toString(),
            sku: sku,
            product_name: lineItem.title || lineItem.name,
            qty: lineItem.quantity,
            qty_linked: 0
        });
        
        // Find product by SKU
        const products = await base44.asServiceRole.entities.Product.filter({ sku: sku });
        if (products.length === 0) continue;
        
        const product = products[0];
        
        // Create reservation in inventory ledger
        await base44.asServiceRole.entities.InventoryLedger.create({
            product_id: product.id,
            product_sku: product.sku,
            product_name: product.name,
            transaction_type: 'reservation',
            quantity: -lineItem.quantity,
            reference_type: 'shopify_order',
            reference_id: order.id.toString(),
            store_id: storeId,
            notes: `Order ${order.name || order.order_number}`
        });
    }
}

async function handleOrderCancelled(base44, order, storeId) {
    // Update ShopifyOrderRef status
    const orderRefs = await base44.asServiceRole.entities.ShopifyOrderRef.filter({
        shopify_order_id: order.id.toString()
    });
    
    if (orderRefs.length > 0) {
        await base44.asServiceRole.entities.ShopifyOrderRef.update(orderRefs[0].id, {
            status: 'cancelled'
        });
    }
    
    // Release reservations
    for (const lineItem of order.line_items || []) {
        const sku = lineItem.sku;
        if (!sku) continue;
        
        const products = await base44.asServiceRole.entities.Product.filter({ sku: sku });
        if (products.length === 0) continue;
        
        const product = products[0];
        
        // Create release_reservation entry
        await base44.asServiceRole.entities.InventoryLedger.create({
            product_id: product.id,
            product_sku: product.sku,
            product_name: product.name,
            transaction_type: 'release_reservation',
            quantity: lineItem.quantity,
            reference_type: 'shopify_order',
            reference_id: order.id.toString(),
            store_id: storeId,
            notes: `Cancelled: ${order.name || order.order_number}`
        });
    }
}

async function handleOrderFulfilled(base44, order, storeId) {
    // Update ShopifyOrderRef status
    const orderRefs = await base44.asServiceRole.entities.ShopifyOrderRef.filter({
        shopify_order_id: order.id.toString()
    });
    
    if (orderRefs.length > 0) {
        await base44.asServiceRole.entities.ShopifyOrderRef.update(orderRefs[0].id, {
            status: 'fulfilled'
        });
    }
}