import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save } from 'lucide-react';

export default function BOMEditor({ 
  productId, 
  productUnit = 'kg',
  bomItems = [], 
  availableComponents = [],
  onSave,
  isLoading 
}) {
  const [items, setItems] = useState(bomItems);
  const [newItem, setNewItem] = useState({ component_id: '', quantity_per_unit: '' });

  const handleAddItem = () => {
    if (!newItem.component_id || !newItem.quantity_per_unit) return;
    
    const component = availableComponents.find(c => c.id === newItem.component_id);
    if (!component) return;

    const exists = items.find(i => i.component_id === newItem.component_id);
    if (exists) return;

    setItems([...items, {
      finished_product_id: productId,
      component_id: newItem.component_id,
      component_sku: component.sku,
      component_name: component.name,
      component_unit: component.unit,
      quantity_per_unit: parseFloat(newItem.quantity_per_unit)
    }]);
    setNewItem({ component_id: '', quantity_per_unit: '' });
  };

  const handleRemoveItem = (componentId) => {
    setItems(items.filter(i => i.component_id !== componentId));
  };

  const handleUpdateQuantity = (componentId, quantity) => {
    setItems(items.map(i => 
      i.component_id === componentId 
        ? { ...i, quantity_per_unit: parseFloat(quantity) || 0 }
        : i
    ));
  };

  const handleSave = () => {
    onSave(items);
  };

  const usedComponentIds = items.map(i => i.component_id);
  const availableForAdd = availableComponents.filter(c => 
    !usedComponentIds.includes(c.id) && c.type !== 'finished_good'
  );

  return (
    <Card className="p-6 border-slate-200">
      <h3 className="font-semibold text-slate-900 mb-4">
        BOM / Recept
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Ange hur mycket av varje komponent som behövs per 1 {productUnit} färdigvara.
      </p>

      {items.length > 0 && (
        <Table className="mb-4">
          <TableHeader>
            <TableRow>
              <TableHead>Komponent</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="w-[150px]">Per 1 {productUnit}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.component_id}>
                <TableCell className="font-medium">{item.component_name}</TableCell>
                <TableCell className="text-slate-500">{item.component_sku}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.quantity_per_unit}
                      onChange={(e) => handleUpdateQuantity(item.component_id, e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-slate-500">{item.component_unit}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.component_id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {availableForAdd.length > 0 && (
        <div className="flex items-end gap-3 p-4 bg-slate-50 rounded-lg">
          <div className="flex-1 space-y-2">
            <Label>Lägg till komponent</Label>
            <Select 
              value={newItem.component_id} 
              onValueChange={(v) => setNewItem({ ...newItem, component_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj komponent..." />
              </SelectTrigger>
              <SelectContent>
                {availableForAdd.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.sku} - {c.name} ({c.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32 space-y-2">
            <Label>Antal per 1 {productUnit}</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={newItem.quantity_per_unit}
              onChange={(e) => setNewItem({ ...newItem, quantity_per_unit: e.target.value })}
              placeholder="0"
            />
          </div>
          <Button onClick={handleAddItem} disabled={!newItem.component_id || !newItem.quantity_per_unit}>
            <Plus className="w-4 h-4 mr-2" />
            Lägg till
          </Button>
        </div>
      )}

      <div className="flex justify-end mt-6 pt-4 border-t">
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'Sparar...' : 'Spara BOM'}
        </Button>
      </div>
    </Card>
  );
}