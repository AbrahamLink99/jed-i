import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, addDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { 
  ShoppingCart, AlertTriangle, CheckCircle, TrendingDown, 
  Package, Calculator, ArrowRight
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { getStockSummary, calculatePurchaseSuggestion } from '@/components/inventory/StockCalculations';

export default function Planning() {
  const [activeTab, setActiveTab] = useState('purchase');
  const [simulationProduct, setSimulationProduct] = useState('');
  const [simulationQty, setSimulationQty] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items'],
    queryFn: () => base44.entities.BOMItem.list()
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list()
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.InventoryLedger.list('-created_date', 1000)
  });

  // Calculate stock for all products
  const stockData = useMemo(() => {
    const data = {};
    products.forEach(product => {
      data[product.id] = getStockSummary(product, ledger, batches);
    });
    return data;
  }, [products, ledger, batches]);

  // Calculate average daily usage based on backflush history
  const avgDailyUsage = useMemo(() => {
    const usage = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    products.forEach(p => {
      const backflushEntries = ledger.filter(e => 
        e.product_id === p.id && 
        e.transaction_type === 'backflush' &&
        new Date(e.created_date) >= thirtyDaysAgo
      );
      const totalUsed = Math.abs(backflushEntries.reduce((sum, e) => sum + e.quantity, 0));
      usage[p.id] = totalUsed / 30;
    });

    return usage;
  }, [products, ledger]);

  // Generate purchase suggestions
  const purchaseSuggestions = useMemo(() => {
    const suggestions = [];
    
    products.filter(p => p.type !== 'finished_good').forEach(product => {
      const stock = stockData[product.id];
      const dailyUsage = avgDailyUsage[product.id] || (product.safety_stock ? product.safety_stock / 30 : 1);
      const suggestion = calculatePurchaseSuggestion(product, stock.onHand, stock.reserved, dailyUsage);
      
      if (suggestion) {
        suggestions.push({
          ...suggestion,
          unit: product.unit,
          supplier: product.supplier,
          moq: product.moq,
          orderMultiple: product.order_multiple
        });
      }
    });

    return suggestions.sort((a, b) => {
      if (a.urgency === 'critical' && b.urgency !== 'critical') return -1;
      if (b.urgency === 'critical' && a.urgency !== 'critical') return 1;
      return new Date(a.orderByDate) - new Date(b.orderByDate);
    });
  }, [products, stockData, avgDailyUsage]);

  // Simulation results
  const simulationResults = useMemo(() => {
    if (!simulationProduct || !simulationQty) return null;

    const product = products.find(p => p.id === simulationProduct);
    if (!product) return null;

    const qty = parseFloat(simulationQty);
    const productBOM = bomItems.filter(b => b.finished_product_id === simulationProduct);

    const impacts = productBOM.map(bom => {
      const component = products.find(p => p.id === bom.component_id);
      if (!component) return null;

      const stock = stockData[bom.component_id] || { onHand: 0 };
      const required = bom.quantity_per_unit * qty;
      const after = stock.onHand - required;

      return {
        componentId: bom.component_id,
        componentSku: component.sku,
        componentName: component.name,
        componentUnit: component.unit,
        required,
        current: stock.onHand,
        after,
        shortage: after < 0,
        safetyStock: component.safety_stock || 0,
        belowSafety: after < (component.safety_stock || 0)
      };
    }).filter(Boolean);

    return {
      product,
      quantity: qty,
      impacts,
      hasShortage: impacts.some(i => i.shortage),
      hasSafetyWarning: impacts.some(i => i.belowSafety && !i.shortage)
    };
  }, [simulationProduct, simulationQty, products, bomItems, stockData]);

  const finishedProducts = products.filter(p => p.type === 'finished_good');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Planering</h1>
          <p className="text-slate-500 mt-1">Inköpsförslag och scenariosimulering</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="purchase">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Inköpsförslag
            </TabsTrigger>
            <TabsTrigger value="simulation">
              <Calculator className="w-4 h-4 mr-2" />
              Simulering
            </TabsTrigger>
          </TabsList>

          {/* Purchase Suggestions */}
          <TabsContent value="purchase">
            {purchaseSuggestions.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500 opacity-50" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Inga inköp behövs</h2>
                <p className="text-slate-500">Alla komponenter har tillräckligt lager</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="p-4 border-b bg-slate-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">{purchaseSuggestions.length} artiklar behöver beställas</span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prioritet</TableHead>
                      <TableHead>Artikel</TableHead>
                      <TableHead>Leverantör</TableHead>
                      <TableHead className="text-right">Nuvarande lager</TableHead>
                      <TableHead className="text-right">Föreslaget</TableHead>
                      <TableHead>Beställ senast</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseSuggestions.map((suggestion, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {suggestion.urgency === 'critical' ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Kritisk
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              Normal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-mono font-medium">{suggestion.productSku}</span>
                            <p className="text-sm text-slate-500">{suggestion.productName}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {suggestion.supplier || '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          suggestion.currentStock <= 0 && "text-red-600"
                        )}>
                          {suggestion.currentStock?.toLocaleString('sv-SE')} {suggestion.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-indigo-600">
                            {suggestion.suggestedQuantity?.toLocaleString('sv-SE')} {suggestion.unit}
                          </div>
                          {suggestion.moq > 1 && (
                            <p className="text-xs text-slate-500">MOQ: {suggestion.moq}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            suggestion.urgency === 'critical' && "text-red-600 font-medium"
                          )}>
                            {format(new Date(suggestion.orderByDate), 'd MMM yyyy', { locale: sv })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Simulation */}
          <TabsContent value="simulation">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input */}
              <Card className="p-6 lg:col-span-1">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-600" />
                  Simulera produktion
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Se vad som händer med komponentlagret om du producerar en viss mängd.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Produkt</Label>
                    <Select value={simulationProduct} onValueChange={setSimulationProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj färdigvara..." />
                      </SelectTrigger>
                      <SelectContent>
                        {finishedProducts.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.sku} - {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Kvantitet (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={simulationQty}
                      onChange={(e) => setSimulationQty(e.target.value)}
                      placeholder="T.ex. 600"
                    />
                  </div>
                </div>
              </Card>

              {/* Results */}
              <Card className="p-6 lg:col-span-2">
                <h3 className="font-semibold text-slate-900 mb-4">Resultat</h3>

                {!simulationResults ? (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Välj produkt och kvantitet för att se simulering</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {simulationResults.hasShortage && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Det finns inte tillräckligt med komponenter för denna produktion.
                        </AlertDescription>
                      </Alert>
                    )}

                    {simulationResults.hasSafetyWarning && !simulationResults.hasShortage && (
                      <Alert className="border-amber-200 bg-amber-50">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          Vissa komponenter hamnar under säkerhetslagret.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!simulationResults.hasShortage && !simulationResults.hasSafetyWarning && (
                      <Alert className="border-emerald-200 bg-emerald-50">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <AlertDescription className="text-emerald-800">
                          Produktionen är genomförbar med nuvarande lager.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Komponent</TableHead>
                            <TableHead className="text-right">Behövs</TableHead>
                            <TableHead className="text-right">Nu</TableHead>
                            <TableHead className="text-center"></TableHead>
                            <TableHead className="text-right">Efter</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {simulationResults.impacts.map((impact, idx) => (
                            <TableRow key={idx} className={cn(
                              impact.shortage && "bg-red-50",
                              impact.belowSafety && !impact.shortage && "bg-amber-50"
                            )}>
                              <TableCell>
                                <div>
                                  <span className="font-mono font-medium">{impact.componentSku}</span>
                                  <p className="text-sm text-slate-500">{impact.componentName}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-slate-600">
                                {impact.required?.toLocaleString('sv-SE')} {impact.componentUnit}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {impact.current?.toLocaleString('sv-SE')}
                              </TableCell>
                              <TableCell className="text-center">
                                <ArrowRight className="w-4 h-4 mx-auto text-slate-400" />
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-semibold",
                                impact.shortage && "text-red-600",
                                impact.belowSafety && !impact.shortage && "text-amber-600",
                                !impact.shortage && !impact.belowSafety && "text-emerald-600"
                              )}>
                                {impact.after?.toLocaleString('sv-SE')} {impact.componentUnit}
                                {impact.shortage && (
                                  <Badge variant="destructive" className="ml-2 text-xs">Brist</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}