import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bell, Package, Activity, ArrowUpRight } from 'lucide-react';
import { getStockSummary } from '@/components/inventory/StockCalculations';
import { cn } from "@/lib/utils";
import { createPageUrl } from '@/utils';

export default function DashboardPage() {
  const envFilter = useEnvironmentFilter();
  const isMonday = new Date().getDay() === 1;

  const { data: products = [] } = useQuery({
    queryKey: ['products', envFilter.environment],
    queryFn: () => base44.entities.Product.filter(envFilter)
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger', envFilter.environment],
    queryFn: () => base44.entities.InventoryLedger.filter(envFilter, '-created_date', 1000)
  });

  const { data: recentLedger = [] } = useQuery({
    queryKey: ['ledger-recent', envFilter.environment],
    queryFn: () => base44.entities.InventoryLedger.filter(envFilter, '-created_date', 5)
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches', envFilter.environment],
    queryFn: () => base44.entities.Batch.filter(envFilter)
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', envFilter.environment],
    queryFn: () => base44.entities.InventoryAlert.filter({ ...envFilter, status: 'OPEN' })
  });

  const { data: mixBatches = [] } = useQuery({
    queryKey: ['mix-batches', envFilter.environment],
    queryFn: () => base44.entities.MixBatch.filter({ ...envFilter, status: 'available' })
  });

  const stockData = useMemo(() => {
    const ledgerForEnv = ledger.filter(e => !e.environment || e.environment === envFilter.environment);
    const map = {};
    products.forEach(p => {
      map[p.id] = getStockSummary(p, ledgerForEnv, batches);
    });
    return map;
  }, [products, ledger, batches, envFilter.environment]);

  const lowestRelative = useMemo(() => {
    return products
      .filter(p => (p.safety_stock || 0) > 0)
      .map(p => {
        const onHand = stockData[p.id]?.onHand || 0;
        const safety = p.safety_stock || 1;
        const ratio = onHand / safety;
        return { product: p, onHand, safety, ratio };
      })
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5);
  }, [products, stockData]);

  const activeAlerts = alerts.length;
  const ongoingBatches = mixBatches.length;
  const underSafetyCount = useMemo(() => products.filter(p => {
    const s = stockData[p.id]?.onHand || 0;
    const ss = p.safety_stock || 0;
    return ss > 0 && s < ss;
  }).length, [products, stockData]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Snabb översikt</p>
        </div>

        {isMonday && (
          <Card className="mb-6 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Dags för veckovis försäljningsimport</div>
              <div className="text-xs text-slate-600">Importera Shopify-försäljning för D2C eller B2B.</div>
            </div>
            <Link to={createPageUrl('Admin') + '?tab=sales'}>
              <Button className="bg-slate-900 text-white">Importera nu</Button>
            </Link>
          </Card>
        )}

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="relative overflow-hidden p-6 bg-[#E8F02A]">
            {/* Diagonal stripe overlay */}
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              <defs>
                <pattern id="diagStripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                  <rect width="4" height="8" fill="#000000" opacity="0.15" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#diagStripes)" />
            </svg>
            {/* Big decorative number */}
            <div className="absolute -right-2 -bottom-6 text-black/10 text-[120px] font-extrabold leading-none select-none">
              {activeAlerts}
            </div>
            <div className="relative">
              <div className="text-sm font-medium text-slate-900">Aktiva notiser</div>
              <div className="mt-1 text-[4rem] leading-none font-extrabold text-slate-900">{activeAlerts}</div>
              <div className="mt-2 flex items-center gap-1 text-slate-700 text-xs">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+0 sedan igår</span>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-6 bg-[#F4833D] text-white">
            <div className="absolute -right-2 -bottom-6 text-white/10 text-[120px] font-extrabold leading-none select-none">
              {underSafetyCount}
            </div>
            <div className="relative">
              <div className="text-sm font-medium">Artiklar under säkerhetslager</div>
              <div className="mt-1 text-[4rem] leading-none font-extrabold">{underSafetyCount}</div>
              <div className="mt-2 flex items-center gap-1 text-white/80 text-xs">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+0 sedan igår</span>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-6 bg-[#1A1A1A] text-white">
            <div className="absolute -right-2 -bottom-6 text-white/10 text-[120px] font-extrabold leading-none select-none">
              {ongoingBatches}
            </div>
            <div className="relative">
              <div className="text-sm font-medium">Pågående batcher</div>
              <div className="mt-1 text-[4rem] leading-none font-extrabold">{ongoingBatches}</div>
              <div className="mt-2 flex items-center gap-1 text-white/70 text-xs">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+0 sedan igår</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Main section: left table + right recent ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-0">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Lägst i förhållande till säkerhetslager</h2>
            </div>
            <div className="px-6 pb-6 space-y-3">
              {lowestRelative.map(({ product, onHand, safety, ratio }) => {
                const statusColor = onHand === 0 ? '#EF4444' : (onHand < safety ? '#F59E0B' : '#E2E8F0');
                const barColor = onHand === 0 ? 'bg-red-500' : (onHand < safety ? 'bg-amber-500' : 'bg-green-500');
                const pct = Math.max(0, Math.min(1, safety ? onHand / safety : 1));
                return (
                  <div key={product.id} className="bg-white rounded-[10px] p-3 border border-slate-200" style={{ borderLeftWidth: 4, borderLeftColor: statusColor }}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{product.sku}</div>
                      </div>
                      <div className="min-w-[160px] text-right">
                        <div className="text-sm font-medium">{onHand?.toLocaleString('sv-SE')} {product.unit}</div>
                        <div className="text-xs text-slate-500">Säkerhet: {safety?.toLocaleString('sv-SE')} {product.unit}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={cn('h-1.5 rounded-full', barColor)} style={{ width: `${(pct*100).toFixed(0)}%` }} />
                      </div>
                      <Badge variant="outline" className="text-xs">{(ratio).toFixed(2)}x</Badge>
                    </div>
                  </div>
                );
              })}
              {lowestRelative.length === 0 && (
                <div className="text-sm text-slate-500 px-2">Inga artiklar under säkerhetslager</div>
              )}
            </div>
          </Card>

          <Card className="p-0">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Senaste transaktioner</h2>
            </div>
            <div className="px-6 pb-6">
              {recentLedger.map((e, i) => {
                const positive = (e.quantity || 0) > 0;
                return (
                  <div key={e.id} className={cn('py-3 flex items-center justify-between', i > 0 && 'border-t border-slate-200')}>
                    <div className="flex items-center gap-3">
                      <div className={cn('h-2.5 w-2.5 rounded-full', positive ? 'bg-green-500' : 'bg-red-500')} />
                      <div>
                        <div className="text-sm font-medium">{e.product_name || e.product_sku}</div>
                        <div className="text-xs text-slate-500">{new Date(e.created_date).toLocaleString('sv-SE')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn('text-xs', positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {e.transaction_type}
                      </Badge>
                      <div className={cn('text-sm font-semibold text-right min-w-[60px]', positive ? 'text-green-600' : 'text-red-600')}>
                        {positive ? '+' : ''}{e.quantity}
                      </div>
                    </div>
                  </div>
                );
              })}
              {recentLedger.length === 0 && (
                <div className="text-sm text-slate-500">Inga transaktioner ännu</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}