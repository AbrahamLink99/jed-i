import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from 'lucide-react';
import { base44 } from "@/api/base44Client";

const productTypes = [
  { value: 'finished_good', label: 'Färdig artikel' },
  { value: 'raw_material', label: 'Råvara' },
  { value: 'packaging', label: 'Förpackning' },
  { value: 'label', label: 'Etikett' }
];

const brandOptions = [
  { value: 'own', label: 'BRUNS' },
  { value: 'client_a', label: 'Kund A' },
  { value: 'client_b', label: 'Kund B' },
  { value: 'other', label: 'Övrigt' }
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
    brand: 'own',
    unit: 'kg',
    safety_stock: 0,
    lead_time_days: 7,
    moq: 1,
    order_multiple: 1,
    supplier: '',
    cost_per_unit: 0,

    notes: '',
    active: true,
    tag_ids: [],
    unlimited_stock: false,
    ...product
  });

  useEffect(() => {
    if (product) {
      setFormData(prev => ({ ...prev, ...product, tag_ids: product.tag_ids || [] }));
    }
  }, [product]);

  const [availableTags, setAvailableTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    (async () => {
      const res = await base44.entities.Tag.list();
      setAvailableTags(res || []);
    })();
  }, []);

  const toggleTag = (id, checked) => {
    setFormData(prev => {
      const set = new Set(prev.tag_ids || []);
      if (checked) set.add(id); else set.delete(id);
      return { ...prev, tag_ids: Array.from(set) };
    });
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    const t = await base44.entities.Tag.create({ name: newTagName.trim(), active: true });
    setAvailableTags(prev => [...prev, t]);
    setNewTagName('');
  };

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
            <Label>Varumärke *</Label>
            <Select value={formData.brand || 'own'} onValueChange={(v) => handleChange('brand', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
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
          <div className="flex items-center gap-2 mt-4">
            <Switch
              id="unlimited_stock"
              checked={!!formData.unlimited_stock}
              onCheckedChange={(v) => handleChange('unlimited_stock', v)}
            />
            <Label htmlFor="unlimited_stock">Obegränsad tillgång</Label>
          </div>
        </div>



        <div className="border-t pt-6">
          <h3 className="font-medium text-slate-900 mb-4">Taggar</h3>
          <div className="flex flex-wrap gap-4 mb-3">
            {availableTags.length === 0 && (
              <p className="text-sm text-slate-500">Inga taggar ännu.</p>
            )}
            {availableTags.map(tag => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={(formData.tag_ids || []).includes(tag.id)}
                  onCheckedChange={(v) => toggleTag(tag.id, !!v)}
                />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ny tagg..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={createTag}>Skapa</Button>
          </div>
        </div>

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

        <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 flex justify-end gap-3 pt-4 border-t">
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