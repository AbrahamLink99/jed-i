import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Package, Factory, ShoppingCart, AlertTriangle, TrendingDown, ArrowRight, Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import StatCard from '@/components/dashboard/StatCard';
import RecentBatches from '@/components/dashboard/RecentBatches';
import PurchaseSuggestions from '@/components/dashboard/PurchaseSuggestions';
import InventoryAlertList from '@/components/alerts/AlertList';
import { getStockSummary, calculatePurchaseSuggestion } from '@/components/inventory/StockCalculations';

export default function Dashboard() {
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list('-created_date', 50)
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.InventoryLedger.list('-created_date', 500)
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['shopify-orders'],
    queryFn: () => base44.entities.ShopifyOrder.filter({ status: 'reserved' })
  });

  const { data: inventoryAlerts = [] } = useQuery({
    queryKey: ['inventory_alerts'],
    queryFn: () => base44.entities.InventoryAlert.filter({ status: 'OPEN' })
  });

  const stats = useMemo(() => {
    const finishedGoods = products.filter(p => p.type === 'finished_good');
    const activeBatches = batches.filter(b => b.status === 'available' || b.status === 'quarantined');
    const pendingOrders = orders.length;

    // Calculate low stock alerts
    const alerts = [];
    products.forEach(product => {
      const stock = getStockSummary(product, ledger, batches);
      if (stock.belowSafety) {
        alerts.push({
          type: 'low_stock',
          severity: stock.onHand <= 0 ? 'critical' : 'warning',
          title: product.sku,
          message: `Lager: ${stock.onHand?.toLocaleString('sv-SE')} ${product.unit} (säkerhet: ${product.safety_stock})`
        });
      }
    });

    // Add blocked batch alerts
    batches.filter(b => b.status === 'blocked' || b.status === 'quarantined').forEach(batch => {
      alerts.push({
        type: 'blocked_batch',
        severity: batch.status === 'blocked' ? 'critical' : 'warning',
        title: `Batch ${batch.batch_number}`,
        message: `${batch.product_sku} - ${batch.status === 'blocked' ? 'Spärrad' : 'Karantän'}`
      });
    });

    // Calculate purchase suggestions
    const suggestions = [];
    products.filter(p => p.type !== 'finished_good').forEach(product => {
      const stock = getStockSummary(product, ledger, batches);
      // Simple avg daily usage estimation
      const avgDailyUsage = product.safety_stock ? product.safety_stock / 30 : 1;
      const suggestion = calculatePurchaseSuggestion(product, stock.onHand, stock.reserved, avgDailyUsage);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    });

    return {
      totalProducts: products.length,
      finishedGoods: finishedGoods.length,
      activeBatches: activeBatches.length,
      pendingOrders,
      alerts,
      suggestions
    };
  }, [products, batches, ledger, orders]);

  const recentBatches = batches.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Översikt över lager och produktion</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Produkter"
            value={stats.totalProducts}
            subtitle={`${stats.finishedGoods} färdigvaror`}
            icon={Package}
          />
          <StatCard
            title="Aktiva batcher"
            value={stats.activeBatches}
            icon={Factory}
          />
          <StatCard
            title="Väntande ordrar"
            value={stats.pendingOrders}
            icon={ShoppingCart}
          />
          <Link to={createPageUrl('Alerts')}>
            <StatCard
              title="Lagernotiser"
              value={inventoryAlerts.length}
              icon={Bell}
              variant={inventoryAlerts.length > 0 ? 'warning' : 'default'}
              clickable
            />
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Link to={createPageUrl('Production')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <Factory className="w-5 h-5 text-indigo-600" />
              <span>Registrera produktion</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Inventory')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              <span>Visa lager</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Batches')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <TrendingDown className="w-5 h-5 text-amber-600" />
              <span>Batcher</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Planning')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              <span>Planering</span>
            </Button>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inventory Alerts */}
          <div className="lg:col-span-1">
            <InventoryAlertList compact />
          </div>

          {/* Recent Batches */}
          <div className="lg:col-span-1">
            <RecentBatches 
              batches={recentBatches}
              onBatchClick={(batch) => {
                window.location.href = createPageUrl('Batches') + `?batch=${batch.id}`;
              }}
            />
          </div>

          {/* Purchase Suggestions */}
          <div className="lg:col-span-1">
            <PurchaseSuggestions 
              suggestions={stats.suggestions}
              onViewAll={() => {
                window.location.href = createPageUrl('Planning');
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}