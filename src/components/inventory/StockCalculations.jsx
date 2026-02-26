// Utility functions for stock calculations
// These follow the append-only ledger principle

export function calculateOnHand(ledgerEntries) {
  // Sum all entries except reservations
  return ledgerEntries
    .filter(e => e.transaction_type !== 'reservation' && e.transaction_type !== 'release_reservation')
    .reduce((sum, e) => sum + e.quantity, 0);
}

export function calculateReserved(ledgerEntries) {
  // Reservations are negative, releases are positive
  const reservations = ledgerEntries
    .filter(e => e.transaction_type === 'reservation')
    .reduce((sum, e) => sum + Math.abs(e.quantity), 0);
  
  const releases = ledgerEntries
    .filter(e => e.transaction_type === 'release_reservation')
    .reduce((sum, e) => sum + e.quantity, 0);
  
  return Math.max(0, reservations - releases);
}

export function calculateAvailable(ledgerEntries, batches, product) {
  const onHand = calculateOnHand(ledgerEntries);
  const reserved = calculateReserved(ledgerEntries);
  
  // Calculate blocked/quarantined batch quantities for finished goods
  const blockedQuantity = batches
    .filter(b => b.product_id === product.id && (b.status === 'blocked' || b.status === 'quarantined'))
    .reduce((sum, b) => sum + b.current_quantity, 0);
  
  return Math.max(0, onHand - reserved - blockedQuantity);
}

export function getStockSummary(product, ledgerEntries, batches) {
  const productLedger = ledgerEntries.filter(e => e.product_id === product.id);
  
  const onHand = calculateOnHand(productLedger);
  const reserved = calculateReserved(productLedger);
  const available = calculateAvailable(productLedger, batches, product);
  
  const safetyStock = product.safety_stock || 0;
  const belowSafety = onHand < safetyStock;
  const daysUntilStockout = product.lead_time_days && available > 0 
    ? Math.floor(available / (safetyStock / 30)) 
    : null;
  
  return {
    onHand,
    reserved,
    available,
    safetyStock,
    belowSafety,
    daysUntilStockout
  };
}

export function generateBatchNumber(productSku) {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${productSku}-${dateStr}-${random}`;
}

export function calculatePurchaseSuggestion(product, currentStock, reservedStock, avgDailyUsage) {
  const safetyStock = product.safety_stock || 0;
  const leadTimeDays = product.lead_time_days || 7;
  const moq = product.moq || 1;
  const orderMultiple = product.order_multiple || 1;
  
  // Calculate reorder point
  const reorderPoint = safetyStock + (avgDailyUsage * leadTimeDays);
  
  // Available stock
  const availableStock = currentStock - reservedStock;
  
  // Do we need to order?
  if (availableStock > reorderPoint) {
    return null;
  }
  
  // Calculate needed quantity
  const shortage = reorderPoint - availableStock + (safetyStock * 2); // Cover safety + buffer
  
  // Round up to MOQ and order multiple
  let orderQty = Math.max(shortage, moq);
  if (orderMultiple > 1) {
    orderQty = Math.ceil(orderQty / orderMultiple) * orderMultiple;
  }
  
  // Calculate order-by date
  const orderByDate = new Date();
  orderByDate.setDate(orderByDate.getDate() - leadTimeDays);
  
  return {
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    suggestedQuantity: orderQty,
    currentStock: availableStock,
    reorderPoint,
    orderByDate,
    leadTimeDays,
    urgency: availableStock < safetyStock ? 'critical' : 'normal'
  };
}