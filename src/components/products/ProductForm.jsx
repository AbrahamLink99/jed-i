import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { X } from 'lucide-react';

const productTypes = [
  { value: 'finished_good', label: 'Färdig artikel' },
  { value: 'raw_material', label: 'Råvara' },
  { value: 'packaging', label: 'Förpackning' },
  { value: 'label', label: 'Etikett' }
];

const units = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'liter', label: 'Liter (l)' },
  { value: 'pcs', label: 'Styck (st)' },
  { value: 'roll', label: 'Rullar' }
];

export default function ProductForm({ product, onSave, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    type: 'finished_good',
    unit: 'kg',
    safety_stock: 0,
    lead_time_days: 7,
    moq: 1,
    order_multiple: 1,
    supplier: '',
    cost_per_unit: 0,
    shopify_buffer: 0,
    notes: '',
    active: true,
    ...product
  });

  useEffect(() => {
    if (product) {
      setFormData({ ...formData, ...product });
    }
  }, [product]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card className="p-6 border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          {product ? 'Redigera produkt' : 'Ny produkt'}
        </h2>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) => handleChange('sku', e.target.value)}
              placeholder="T.ex. SCHAMPO-500ML"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Namn *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Produktnamn"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Typ *</Label>
            <Select value={formData.type} onValueChange={(v) => handleChange('type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productTypes.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Enhet *</Label>
            <Select value={formData.unit} onValueChange={(v) => handleChange('unit', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-medium text-slate-900 mb-4">Planeringsparametrar</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="safety_stock">Säkerhetslager</Label>
              <Input
                id="safety_stock"
                type="number"
                min="0"
                step="0.1"
                value={formData.safety_stock || ''}
                onChange={(e) => handleChange('safety_stock', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead_time_days">Ledtid (dagar)</Label>
              <Input
                id="lead_time_days"
                type="number"
                min="0"
                value={formData.lead_time_days || ''}
                onChange={(e) => handleChange('lead_time_days', e.target.value === '' ? 0 : parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="moq">Minsta orderkvantitet</Label>
              <Input
                id="moq"
                type="number"
                min="1"
                value={formData.moq || ''}
                onChange={(e) => handleChange('moq', e.target.value === '' ? 1 : parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_multiple">Ordermultipel</Label>
              <Input
                id="order_multiple"
                type="number"
                min="1"
                value={formData.order_multiple || ''}
                onChange={(e) => handleChange('order_multiple', e.target.value === '' ? 1 : parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Leverantör</Label>
              <Input
                id="supplier"
                value={formData.supplier || ''}
                onChange={(e) => handleChange('supplier', e.target.value)}
                placeholder="Leverantörsnamn"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_per_unit">Kostnad per enhet (SEK)</Label>
              <Input
                id="cost_per_unit"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost_per_unit || ''}
                onChange={(e) => handleChange('cost_per_unit', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        {formData.type === 'finished_good' && (
          <div className="border-t pt-6">
            <h3 className="font-medium text-slate-900 mb-4">Shopify-inställningar</h3>
            <div className="space-y-2">
              <Label htmlFor="shopify_buffer">Buffert (dras från tillgängligt)</Label>
              <Input
                id="shopify_buffer"
                type="number"
                min="0"
                value={formData.shopify_buffer || ''}
                onChange={(e) => handleChange('shopify_buffer', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
              <p className="text-sm text-slate-500">
                Antal enheter som alltid hålls tillbaka från "Available to sell"
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Anteckningar</Label>
          <Textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Valfria anteckningar..."
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="active"
            checked={formData.active !== false}
            onCheckedChange={(v) => handleChange('active', v)}
          />
          <Label htmlFor="active">Aktiv</Label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Avbryt
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Sparar...' : (product ? 'Uppdatera' : 'Skapa')}
          </Button>
        </div>
      </form>
    </Card>
  );
}