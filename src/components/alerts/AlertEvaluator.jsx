import { base44 } from '@/api/base44Client';
import { getStockSummary } from '@/components/inventory/StockCalculations';

/**
 * Evaluates inventory alerts for all products
 * Creates or updates alerts based on stock levels and rules
 */
export async function evaluateInventoryAlerts() {
  const products = await base44.entities.Product.filter({ environment: 'production' }, '-name', 5000);
  const ledgerEntries = await base44.entities.InventoryLedger.filter({ environment: 'production' }, '-created_date', 50000);
  const batches = await base44.entities.Batch.filter({ environment: 'production' }, '-created_date', 5000);
  const existingAlerts = await base44.entities.InventoryAlert.filter({
    status: { $in: ['OPEN', 'ORDERED_ACKNOWLEDGED'] },
    environment: 'production'
  }, '-updated_date', 5000);

  const now = new Date().toISOString();
  const alertsToCreate = [];
  const alertsToUpdate = [];

  // 1) Cleanup duplicates: keep the highest severity per product, close the rest
  const severityRank = { critical: 3, warning: 2, info: 1 };
  const byProduct = existingAlerts.reduce((acc, a) => {
    (acc[a.product_id] ||= []).push(a);
    return acc;
  }, {});

  for (const [productId, list] of Object.entries(byProduct)) {
    if (list.length <= 1) continue;
    let keep = list[0];
    for (const a of list) {
      if (severityRank[a.severity] > severityRank[keep.severity]) keep = a;
    }
    for (const a of list) {
      if (a.id !== keep.id) {
        await base44.entities.InventoryAlert.update(a.id, {
          status: 'CLOSED',
          resolved_at: now,
          resolved_by: 'system'
        });
      }
    }
  }

  // Re-fetch actives after cleanup map
  const activesAfterCleanup = await base44.entities.InventoryAlert.filter({
    status: { $in: ['OPEN', 'ORDERED_ACKNOWLEDGED'] },
    environment: 'production'
  }, '-updated_date', 5000);
  const activeByProduct = activesAfterCleanup.reduce((acc, a) => {
    acc[a.product_id] = a; // max one after cleanup
    return acc;
  }, {});

  // 2) Single-rule evaluation per product
  let debugCount = 0;
  for (const product of products) {
    if (!product.active) continue;

    // Skip unlimited stock products and auto-close any active alerts
    if (product.unlimited_stock === true) {
      const existing = activeByProduct[product.id];
      if (existing) {
        await base44.entities.InventoryAlert.update(existing.id, {
          status: 'CLOSED',
          resolved_at: now,
          resolved_by: 'system'
        });
      }
      continue;
    }

    const productLedger = ledgerEntries.filter(e => e.product_id === product.id);
    const productBatches = batches.filter(b => b.product_id === product.id);
    const stockSummary = getStockSummary(product, productLedger, productBatches);

    if (debugCount < 3) {
      console.log('[AlertEvaluator]', product.sku, { onHand: stockSummary.onHand, available: stockSummary.available });
      debugCount++;
    }

    const {
      available,
      safetyStock = product.safety_stock || 0,
      reorderPoint = product.safety_stock || 0
    } = stockSummary;

    let target = null; // {severity, type, message}
    if (available <= 0) {
      target = {
        severity: 'critical',
        type: 'LOW_STOCK',
        message: `${product.name} är slut i lager.`
      };
    } else if (available <= safetyStock && safetyStock > 0) {
      target = {
        severity: 'warning',
        type: 'BELOW_SAFETY',
        message: `${product.name} är under säkerhetslagret. Tillgängligt: ${available}, Säkerhetslager: ${safetyStock}.`
      };
    } else if (available <= reorderPoint && reorderPoint > 0) {
      target = {
        severity: 'info',
        type: 'LOW_STOCK',
        message: `${product.name} har nått beställningspunkten.`
      };
    }

    const existing = activeByProduct[product.id];

    if (target) {
      // compute optional suggestion/dates when relevant
      const leadTimeDays = product.lead_time_days || 7;
      const orderByDate = new Date();
      orderByDate.setDate(orderByDate.getDate() + 1);
      const needByDate = new Date();
      needByDate.setDate(needByDate.getDate() + leadTimeDays);
      const suggestedOrderQty = reorderPoint > 0 ? Math.max(reorderPoint * 2 - available, product.moq || 0) : undefined;

      if (existing) {
        alertsToUpdate.push({
          id: existing.id,
          data: {
            severity: target.severity,
            type: target.type,
            message: target.message,
            current_available_qty: available,
            safety_stock: safetyStock,
            reorder_point: reorderPoint,
            suggested_order_qty: suggestedOrderQty,
            order_by_date: orderByDate.toISOString().split('T')[0],
            need_by_date: needByDate.toISOString().split('T')[0],
            last_evaluated_at: now
          }
        });
      } else {
        alertsToCreate.push({
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          product_type: product.type,
          severity: target.severity,
          type: target.type,
          status: 'OPEN',
          message: target.message,
          current_available_qty: available,
          safety_stock: safetyStock,
          reorder_point: reorderPoint,
          suggested_order_qty: suggestedOrderQty,
          order_by_date: orderByDate.toISOString().split('T')[0],
          need_by_date: needByDate.toISOString().split('T')[0],
          last_evaluated_at: now
        });
      }
    } else if (existing) {
      // Stock recovered above reorder point -> auto-close
      await base44.entities.InventoryAlert.update(existing.id, {
        status: 'CLOSED',
        resolved_at: now,
        resolved_by: 'system'
      });
    }
  }

  if (alertsToCreate.length > 0) {
    for (const alert of alertsToCreate) {
      await base44.entities.InventoryAlert.create(alert);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  for (const update of alertsToUpdate) {
    await base44.entities.InventoryAlert.update(update.id, update.data);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return {
    created: alertsToCreate.length,
    updated: alertsToUpdate.length
  };
}