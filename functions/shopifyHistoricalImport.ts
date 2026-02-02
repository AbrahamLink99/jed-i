import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { year = 2025, storeId = 'b2c' } = await req.json();

    const storeDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    
    // Get access token from ShopifyConnection entity
    const connections = await base44.asServiceRole.entities.ShopifyConnection.list();
    if (!connections || connections.length === 0) {
      return Response.json({ 
        error: 'Shopify not connected. Please connect Shopify first.',
        needsAuth: true
      }, { status: 400 });
    }

    const accessToken = connections[0].access_token;

    if (!storeDomain || !accessToken) {
      return Response.json({ 
        error: 'Shopify credentials missing.',
        needsAuth: true
      }, { status: 400 });
    }

    // Date range for the year
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year}-12-31T23:59:59Z`;

    // Fetch orders from Shopify
    const orders = await fetchAllOrders(storeDomain, accessToken, startDate, endDate);

    // Aggregate sales data by SKU
    const salesBySku = {};
    const monthlyData = {};

    for (const order of orders) {
      const orderDate = new Date(order.created_at);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

      for (const item of order.line_items) {
        const sku = item.sku || item.variant_id?.toString() || 'UNKNOWN';
        
        // Aggregate total
        if (!salesBySku[sku]) {
          salesBySku[sku] = {
            sku,
            productName: item.name,
            totalQuantity: 0,
            totalOrders: 0,
            totalRevenue: 0,
            monthlyBreakdown: {}
          };
        }

        salesBySku[sku].totalQuantity += item.quantity;
        salesBySku[sku].totalOrders += 1;
        salesBySku[sku].totalRevenue += parseFloat(item.price) * item.quantity;

        // Monthly breakdown
        if (!salesBySku[sku].monthlyBreakdown[monthKey]) {
          salesBySku[sku].monthlyBreakdown[monthKey] = 0;
        }
        salesBySku[sku].monthlyBreakdown[monthKey] += item.quantity;

        // Track monthly totals
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { orders: 0, revenue: 0, items: 0 };
        }
        monthlyData[monthKey].orders += 1;
        monthlyData[monthKey].revenue += parseFloat(item.price) * item.quantity;
        monthlyData[monthKey].items += item.quantity;
      }
    }

    const summary = {
      year,
      storeId,
      totalOrders: orders.length,
      uniqueProducts: Object.keys(salesBySku).length,
      topProducts: Object.values(salesBySku)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10),
      monthlyData,
      salesBySku: Object.values(salesBySku)
    };

    return Response.json({ 
      success: true, 
      summary,
      importedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Shopify import error:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});

async function fetchAllOrders(storeDomain, accessToken, startDate, endDate) {
  const allOrders = [];
  let pageInfo = null;
  const limit = 250;

  do {
    const url = new URL(`https://${storeDomain}/admin/api/2024-01/orders.json`);
    url.searchParams.set('status', 'any');
    url.searchParams.set('created_at_min', startDate);
    url.searchParams.set('created_at_max', endDate);
    url.searchParams.set('limit', limit);
    
    if (pageInfo) {
      url.searchParams.set('page_info', pageInfo);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    allOrders.push(...data.orders);

    // Check for pagination
    const linkHeader = response.headers.get('Link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/page_info=([^&>]+)/);
      pageInfo = match ? match[1] : null;
    } else {
      pageInfo = null;
    }

  } while (pageInfo);

  return allOrders;
}