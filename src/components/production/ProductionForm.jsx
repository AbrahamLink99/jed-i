import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Factory, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { format } from 'date-fns';

export default function ProductionForm({ 
  recipeOptions = [],
  componentStock = {},
  onSubmit,
  isLoading,
 }) {
  const [selectedRecipe, setSelectedRecipe] = useState('');
  // removed isMix toggle – always mixing
  const [quantity, setQuantity] = useState('');
  const [productionDate, setProductionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  const productList = mixEligibleProducts;
  const product = productList.find(p => p.id === selectedProduct);
  const productBOM = bomItems.filter(b => b.finished_product_id === selectedProduct);

  const componentImpact = useMemo(() => {
    if (!selectedProduct || !quantity || !productBOM.length) return [];

    const qty = parseFloat(quantity) || 0;
    return productBOM.map(bom => {
      const required = bom.quantity_per_unit * qty;
      const current = componentStock[bom.component_id] || 0;
      const after = current - required;
      const shortage = after < 0;

      return {
        ...bom,
        required,
        current,
        after,
        shortage
      };
    });
  }, [selectedProduct, quantity, productBOM, componentStock]);

  const hasShortage = componentImpact.some(c => c.shortage);
  const canProduce = selectedProduct && quantity && parseFloat(quantity) > 0 && !(product && product._missing);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canProduce) return;

    onSubmit({
      productId: selectedProduct,
      product,
      quantity: parseFloat(quantity),
      productionDate,
      notes,
      componentImpact,
      isMix,
      batchNumber
    });
  };

  return (
    <Card className="p-6 border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-100">
            <Factory className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Registrera produktion</h2>
            <p className="text-sm text-slate-500">Deklarera vad som har producerats</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-600">Blandning (bulk för tappning)</Label>
          <Switch checked={isMix} onCheckedChange={setIsMix} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Välj produkt att tillverka</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Välj produkt att tillverka..." />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                {productList.length === 0 && (
                  <SelectItem value="__empty" disabled>
                    Inga produkter hittades
                  </SelectItem>
                )}
                {productList.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.sku} - {p.name} {p._missing ? '• saknas i Artiklar' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {product?._missing && (
              <Alert variant="destructive">
                <AlertDescription>
                  Receptets blandning saknar motsvarande produkt i Artiklar. Skapa en produkt med SKU {product?.sku} för att kunna registrera produktion.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Kvantitet ({product?.unit || 'kg'}) *</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="T.ex. 600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Produktionsdatum</Label>
            <Input
              id="date"
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batchNumber">Batchnummer (valfritt)</Label>
            <Input
              id="batchNumber"
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="Lämna tomt för auto-generering"
            />
          </div>
        </div>

        {componentImpact.length > 0 && (
          <div className="border rounded-lg p-4 bg-slate-50">
            <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Komponentförbrukning (backflush)
            </h3>
            <div className="space-y-2">
              {componentImpact.map((c, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    c.shortage ? 'bg-red-50 border border-red-200' : 'bg-white border border-slate-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{c.component_sku}</span>
                      {c.shortage && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Brist
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{c.component_name}</p>
                  </div>
                  <div className="text-right ml-4 text-sm">
                    <p className="text-slate-500">
                      {c.current?.toLocaleString('sv-SE')} → <span className={c.shortage ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                        {c.after?.toLocaleString('sv-SE')}
                      </span> {c.component_unit}
                    </p>
                    <p className="text-slate-400">
                      -{c.required?.toLocaleString('sv-SE')} {c.component_unit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasShortage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Det finns inte tillräckligt med komponenter i lager. Du kan fortfarande registrera produktionen, 
              men lagersaldon kommer att bli negativa.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Anteckningar</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Valfria anteckningar om produktionen..."
            rows={2}
          />
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button 
            type="submit" 
            disabled={!canProduce || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? (
              'Registrerar...'
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Registrera produktion
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}