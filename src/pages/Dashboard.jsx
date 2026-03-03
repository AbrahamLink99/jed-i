import React, { useMemo } from 'react';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bell, Package, Activity } from 'lucide-react';
import { getStockSummary } from '@/components/inventory/StockCalculations';
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const envFilter = useEnvironmentFilter();

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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Snabb översikt</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-[#E8F02A]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">Aktiva notiser</div>
                <div className="text-4xl font-bold text-slate-900 mt-1">{activeAlerts}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-[#F4833D] text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Artiklar under säkerhetslager</div>
                <div className="text-4xl font-bold mt-1">{underSafetyCount}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-[#1A1A1A] text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Pågående batcher</div>
                <div className="text-4xl font-bold mt-1">{ongoingBatches}</div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artikel</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>I lager</TableHead>
                  <TableHead>Säkerhetslager</TableHead>
                  <TableHead>Kvot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowestRelative.map(({ product, onHand, safety, ratio }) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell className="text-slate-500 font-mono">{product.sku}</TableCell>
                    <TableCell>{onHand?.toLocaleString('sv-SE')} {product.unit}</TableCell>
                    <TableCell>{safety?.toLocaleString('sv-SE')} {product.unit}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {(ratio).toFixed(2)}x
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {lowestRelative.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Inga artiklar under säkerhetslager</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-0">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Senaste transaktioner</h2>
            </div>
            <div className="px-6 pb-6 space-y-4">
              {recentLedger.map((e) => (
                <div key={e.id} className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{e.product_name || e.product_sku}</div>
                    <div className="text-xs text-slate-500">{e.transaction_type} • {new Date(e.created_date).toLocaleString('sv-SE')}</div>
                  </div>
                  <div className={cn("text-sm font-semibold", e.quantity < 0 ? 'text-red-600' : 'text-green-600')}>
                    {e.quantity > 0 ? '+' : ''}{e.quantity}
                  </div>
                </div>
              ))}
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