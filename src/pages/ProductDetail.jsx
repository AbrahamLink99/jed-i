import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getStockSummary } from '@/components/inventory/StockCalculations';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';
import { Package, ArrowLeft } from 'lucide-react';

export default function ProductDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('productId');
  const envFilter = useEnvironmentFilter();

  const { data: products = [] } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await base44.entities.Product.filter({ id: productId });
      return res || [];
    },
    enabled: !!productId
  });

  const product = products[0];

  const brandText = React.useMemo(() => {
    const map = { own: 'BRUNS', client_a: 'Kund A', client_b: 'Kund B', other: 'Övrigt' };
    return map[product?.brand || 'own'] || '';
  }, [product]);

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger-by-product', productId, envFilter.environment],
    queryFn: () => base44.entities.InventoryLedger.filter({ product_id: productId, environment: envFilter.environment }, '-created_date', 1000),
    enabled: !!productId
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-by-product', productId, envFilter.environment],
    queryFn: () => base44.entities.BOMItem.filter({ finished_product_id: productId, environment: envFilter.environment }),
    enabled: !!productId
  });

  const stock = useMemo(() => {
    if (!product) return { onHand: 0 };
    return getStockSummary(product, ledger, []);
  }, [product, ledger]);

  const inboundHistory = useMemo(() => {
    return (ledger || [])
      .filter(l => l.quantity > 0 && (l.transaction_type === 'inbound' || l.transaction_type === 'adjustment'))
      .slice(0, 50);
  }, [ledger]);

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <Link to={createPageUrl('Products')} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
            <ArrowLeft className="w-4 h-4" /> Tillbaka
          </Link>
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Produkten hittades inte.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to={createPageUrl('Products')} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Tillbaka
          </Link>
          <div className="text-right">
            <h1 className="text-2xl font-bold">{product.sku} – {product.name}</h1>
            <p className="text-slate-500">{product.type} • {product.unit} • {brandText}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle>Lagerstatus</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold">{(stock.onHand || 0).toLocaleString('sv-SE')} {product.unit}</div>
              <div className="text-slate-600 text-sm">Säkerhetslager: {product.safety_stock ?? '-'}</div>
              <div className="text-slate-600 text-sm">Ledtid: {product.lead_time_days ? `${product.lead_time_days} dagar` : '-'}</div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Produktinformation</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">SKU</span><div className="font-medium">{product.sku}</div></div>
              <div><span className="text-slate-500">Namn</span><div className="font-medium">{product.name}</div></div>
              <div><span className="text-slate-500">Typ</span><div><Badge>{product.type}</Badge></div></div>
              <div><span className="text-slate-500">Varumärke</span><div className="font-medium">{product.brand || 'own'}</div></div>
              <div><span className="text-slate-500">Enhet</span><div className="font-medium">{product.unit}</div></div>
              <div><span className="text-slate-500">Leverantör</span><div className="font-medium">{product.supplier || '-'}</div></div>
              <div><span className="text-slate-500">Kostnad</span><div className="font-medium">{product.cost_per_unit ? `${product.cost_per_unit} kr` : '-'}</div></div>
              <div><span className="text-slate-500">Aktiv</span><div className="font-medium">{product.active !== false ? 'Ja' : 'Nej'}</div></div>
              {product.notes && (
                <div className="col-span-2"><span className="text-slate-500">Anteckningar</span><div className="font-medium whitespace-pre-wrap">{product.notes}</div></div>
              )}
            </CardContent>
          </Card>
        </div>

        {product.type === 'finished_good' && (
          <Card>
            <CardHeader><CardTitle>Recept (BOM)</CardTitle></CardHeader>
            <CardContent>
              {bomItems.length === 0 ? (
                <div className="text-slate-500">Inget recept registrerat.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Komponent SKU</TableHead>
                      <TableHead>Namn</TableHead>
                      <TableHead>Mängd / enhet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomItems.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{b.component_sku || b.component_id}</TableCell>
                        <TableCell>{b.component_name || ''}</TableCell>
                        <TableCell>{b.quantity_per_unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Inköpshistorik</CardTitle></CardHeader>
          <CardContent>
            {inboundHistory.length === 0 ? (
              <div className="text-slate-500">Ingen historik.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Kvantitet</TableHead>
                    <TableHead>Ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboundHistory.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{new Date(l.created_date || l.updated_date || Date.now()).toLocaleString('sv-SE')}</TableCell>
                      <TableCell><Badge variant="outline">{l.transaction_type}</Badge></TableCell>
                      <TableCell>{l.quantity}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{l.reference_type || '-'} {l.reference_id || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Link to={createPageUrl('Products')}>
            <Button variant="outline">Tillbaks till listan</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}