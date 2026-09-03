import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SHOP = 'brunsprofessional.myshopify.com';
const API_VERSION = '2024-01';

async function fetchAllOrders(accessToken, createdAtMin) {
  const orders = [];
  let url = `https://${SHOP}/admin/api/${API_VERSION}/orders.json?status=any&limit=250&created_at_min=${createdAtMin}`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    orders.push(...(data.orders || []));

    // Handle pagination via Link header
    const linkHeader = res.headers.get('Link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = match ? match[1] : null;
    } else {
      url = null;
    }
  }

  return orders;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!accessToken) {
      return Response.json({ error: 'SHOPIFY_ACCESS_TOKEN not set' }, { status: 500 });
    }

    // Fetch orders created in the last 25 hours (overlap for safety)
    const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const orders = await fetchAllOrders(accessToken, since);

    console.log(`Fetched ${orders.length} orders from Shopify since ${since}`);

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        // Build a normalized record
        const record = {
          shopify_order_id: String(order.id),
          order_number: order.order_number ? String(order.order_number) : order.name,
          store_id: 'b2c',
          status: order.financial_status || 'unknown',
          fulfillment_status: order.fulfillment_status || 'unfulfilled',
          total_price: parseFloat(order.total_price || '0'),
          subtotal_price: parseFloat(order.subtotal_price || '0'),
          total_tax: parseFloat(order.total_tax || '0'),
          currency: order.currency || 'SEK',
          customer_email: order.email || '',
          customer_name: order.billing_address
            ? `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim()
            : (order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : ''),
          line_items: (order.line_items || []).map(li => ({
            product_id: String(li.product_id || ''),
            variant_id: String(li.variant_id || ''),
            sku: li.sku || '',
            name: li.name || '',
            quantity: li.quantity || 0,
            price: parseFloat(li.price || '0'),
          })),
          created_at_shopify: order.created_at,
          processed_at: order.processed_at || order.created_at,
          tags: order.tags || '',
          note: order.note || '',
          environment: 'production',
        };

        // Check if order already exists
        const existing = await base44.asServiceRole.entities.ShopifyOrder.filter({
          shopify_order_id: record.shopify_order_id,
        });

        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.ShopifyOrder.update(existing[0].id, record);
          updated++;
        } else {
          await base44.asServiceRole.entities.ShopifyOrder.create(record);
          created++;
        }
      } catch (err) {
        console.error(`Error processing order ${order.id}:`, err.message);
        errors++;
      }
    }

    const summary = {
      success: true,
      fetched: orders.length,
      created,
      updated,
      errors,
      since,
    };

    console.log('Sync complete:', JSON.stringify(summary));
    return Response.json(summary);

  } catch (error) {
    console.error('Sync failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});