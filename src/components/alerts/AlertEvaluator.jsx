import { base44 } from '@/api/base44Client';
import { calculateStockSummary } from '@/components/inventory/StockCalculations';

/**
 * Evaluates inventory alerts for all products
 * Creates or updates alerts based on stock levels and rules
 */
export async function evaluateInventoryAlerts() {
  const products = await base44.entities.Product.list();
  const ledgerEntries = await base44.entities.InventoryLedger.list();
  const batches = await base44.entities.Batch.list();
  const existingAlerts = await base44.entities.InventoryAlert.filter({ 
    status: { $in: ['OPEN', 'ORDERED_ACKNOWLEDGED'] }
  });

  const now = new Date().toISOString();
  const alertsToCreate = [];
  const alertsToUpdate = [];

  for (const product of products) {
    if (!product.active) continue;

    const productLedger = ledgerEntries.filter(e => e.product_id === product.id);
    const productBatches = batches.filter(b => b.product_id === product.id);
    
    const stockSummary = calculateStockSummary(product, productLedger, productBatches);
    
    const {
      onHand,
      reserved,
      available,
      safetyStock = product.safety_stock || 0,
      reorderPoint = product.safety_stock || 0
    } = stockSummary;

    // Check for existing alert of each type
    const existingLowStock = existingAlerts.find(
      a => a.product_id === product.id && a.type === 'LOW_STOCK'
    );
    const existingBelowSafety = existingAlerts.find(
      a => a.product_id === product.id && a.type === 'BELOW_SAFETY'
    );

    // Rule 1: LOW_STOCK - available <= reorderPoint
    if (available <= reorderPoint && reorderPoint > 0) {
      const severity = available <= 0 ? 'critical' : available <= safetyStock ? 'warning' : 'info';
      const message = `${product.name} (${product.sku}) har nått beställningspunkten. Tillgängligt: ${available} ${product.unit}, Beställningspunkt: ${reorderPoint} ${product.unit}`;
      
      const suggestedOrderQty = Math.max(
        reorderPoint * 2 - available,
        product.moq || 0
      );

      const leadTimeDays = product.lead_time_days || 7;
      const orderByDate = new Date();
      orderByDate.setDate(orderByDate.getDate() + 1);

      const needByDate = new Date();
      needByDate.setDate(needByDate.getDate() + leadTimeDays);

      if (existingLowStock) {
        if (existingLowStock.status === 'OPEN') {
          alertsToUpdate.push({
            id: existingLowStock.id,
            data: {
              severity,
              message,
              current_available_qty: available,
              suggested_order_qty: suggestedOrderQty,
              last_evaluated_at: now,
              order_by_date: orderByDate.toISOString().split('T')[0],
              need_by_date: needByDate.toISOString().split('T')[0]
            }
          });
        }
      } else {
        alertsToCreate.push({
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          product_type: product.type,
          severity,
          type: 'LOW_STOCK',
          status: 'OPEN',
          message,
          current_available_qty: available,
          reorder_point: reorderPoint,
          safety_stock: safetyStock,
          suggested_order_qty: suggestedOrderQty,
          order_by_date: orderByDate.toISOString().split('T')[0],
          need_by_date: needByDate.toISOString().split('T')[0],
          last_evaluated_at: now
        });
      }
    } else if (existingLowStock && existingLowStock.status === 'ORDERED_ACKNOWLEDGED' && available > reorderPoint) {
      // Auto-close if stock is back above reorder point
      await base44.entities.InventoryAlert.update(existingLowStock.id, {
        status: 'CLOSED',
        resolved_at: now,
        resolved_by: 'system'
      });
    }

    // Rule 2: BELOW_SAFETY - available < safetyStock
    if (available < safetyStock && safetyStock > 0) {
      const severity = available <= 0 ? 'critical' : 'warning';
      const message = `${product.name} (${product.sku}) är under säkerhetslagret. Tillgängligt: ${available} ${product.unit}, Säkerhetslager: ${safetyStock} ${product.unit}`;
      
      if (existingBelowSafety) {
        if (existingBelowSafety.status === 'OPEN') {
          alertsToUpdate.push({
            id: existingBelowSafety.id,
            data: {
              severity,
              message,
              current_available_qty: available,
              last_evaluated_at: now
            }
          });
        }
      } else {
        alertsToCreate.push({
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          product_type: product.type,
          severity,
          type: 'BELOW_SAFETY',
          status: 'OPEN',
          message,
          current_available_qty: available,
          safety_stock: safetyStock,
          last_evaluated_at: now
        });
      }
    } else if (existingBelowSafety && existingBelowSafety.status === 'ORDERED_ACKNOWLEDGED' && available >= safetyStock) {
      await base44.entities.InventoryAlert.update(existingBelowSafety.id, {
        status: 'CLOSED',
        resolved_at: now,
        resolved_by: 'system'
      });
    }
  }

  // Create new alerts
  if (alertsToCreate.length > 0) {
    await base44.entities.InventoryAlert.bulkCreate(alertsToCreate);
  }

  // Update existing alerts
  for (const update of alertsToUpdate) {
    await base44.entities.InventoryAlert.update(update.id, update.data);
  }

  return {
    created: alertsToCreate.length,
    updated: alertsToUpdate.length
  };
}