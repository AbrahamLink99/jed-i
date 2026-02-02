import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, TrendingUp, Package, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ShopifyHistoricalImport() {
  const [year, setYear] = useState('2025');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data } = await base44.functions.invoke('shopifyHistoricalImport', {
        year: parseInt(year),
        storeId: 'b2c'
      });

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Import misslyckades');
      }
    } catch (err) {
      setError(err.message || 'Ett fel uppstod vid import');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!result?.summary?.salesBySku) return;

    const headers = ['SKU', 'Produktnamn', 'Total försäljning', 'Antal ordrar', 'Total intäkt', 'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const rows = result.summary.salesBySku.map(product => {
      const monthly = [];
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        monthly.push(product.monthlyBreakdown[key] || 0);
      }

      return [
        product.sku,
        product.productName,
        product.totalQuantity,
        product.totalOrders,
        Math.round(product.totalRevenue),
        ...monthly
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopify_sales_${year}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-cyan-600" />
          Importera Shopify Historik
        </CardTitle>
        <CardDescription>
          Hämta försäljningsdata från Shopify för planering och prognos
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Import Controls */}
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Välj år
            </label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleImport} 
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {loading ? 'Importerar...' : 'Hämta data'}
          </Button>

          {result && (
            <Button 
              onClick={exportToCSV}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportera CSV
            </Button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Summary */}
        {result?.summary && (
          <div className="space-y-6">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Import lyckades! Data från {result.summary.totalOrders} ordrar importerad.
              </AlertDescription>
            </Alert>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-slate-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-cyan-600" />
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        {result.summary.totalOrders}
                      </div>
                      <div className="text-sm text-slate-600">Totalt ordrar</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-cyan-600" />
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        {result.summary.uniqueProducts}
                      </div>
                      <div className="text-sm text-slate-600">Unika produkter</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-8 h-8 text-cyan-600" />
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        {result.summary.year}
                      </div>
                      <div className="text-sm text-slate-600">År</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Products */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                Mest sålda produkter
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produktnamn</TableHead>
                      <TableHead className="text-right">Total försäljning</TableHead>
                      <TableHead className="text-right">Ordrar</TableHead>
                      <TableHead className="text-right">Intäkt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.summary.topProducts.map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>{product.productName}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {product.totalQuantity}
                        </TableCell>
                        <TableCell className="text-right">{product.totalOrders}</TableCell>
                        <TableCell className="text-right">
                          {Math.round(product.totalRevenue)} kr
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}