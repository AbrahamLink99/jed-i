import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

const typeColors = {
  raw_material: 'bg-amber-100 text-amber-700',
  packaging: 'bg-cyan-100 text-cyan-700',
  label: 'bg-pink-100 text-pink-700'
};

const typeLabels = {
  raw_material: 'Råvara',
  packaging: 'Förpackning',
  label: 'Etikett'
};

export default function RecipeForm({ recipe, availableProducts, availableComponents, onClose }) {
  const [selectedProduct, setSelectedProduct] = useState(recipe?.id || '');
  const [components, setComponents] = useState(recipe?.components || []);
  const [newComponent, setNewComponent] = useState({ component_id: '', quantity_per_unit: '' });

  const queryClient = useQueryClient();

  const finishedGoods = availableProducts.filter(p => p.type === 'finished_good');
  const selectedProductData = availableProducts.find(p => p.id === selectedProduct);

  const saveRecipeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) {
        throw new Error('Välj en färdigvara');
      }
      if (components.length === 0) {
        throw new Error('Lägg till minst en komponent');
      }

      // Delete existing BOM items
      const existing = await base44.entities.BOMItem.filter({ 
        finished_product_id: selectedProduct 
      });
      for (const item of existing) {
        await base44.entities.BOMItem.delete(item.id);
      }

      // Create new BOM items
      for (const comp of components) {
        await base44.entities.BOMItem.create({
          finished_product_id: selectedProduct,
          component_id: comp.component_id,
          quantity_per_unit: parseFloat(comp.quantity_per_unit)
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
      toast.success('Recept sparat');
      onClose();
    },
    onError: (error) => {
      toast.error('Kunde inte spara recept: ' + error.message);
    }
  });

  const handleAddComponent = () => {
    if (!newComponent.component_id || !newComponent.quantity_per_unit) {
      toast.error('Fyll i både komponent och mängd');
      return;
    }

    const component = availableComponents.find(c => c.id === newComponent.component_id);
    if (!component) return;

    const exists = components.find(c => c.component_id === newComponent.component_id);
    if (exists) {
      toast.error('Komponenten finns redan i receptet');
      return;
    }

    setComponents([...components, {
      component_id: newComponent.component_id,
      component_sku: component.sku,
      component_name: component.name,
      component_unit: component.unit,
      component_type: component.type,
      quantity_per_unit: parseFloat(newComponent.quantity_per_unit)
    }]);

    setNewComponent({ component_id: '', quantity_per_unit: '' });
  };

  const handleRemoveComponent = (componentId) => {
    setComponents(components.filter(c => c.component_id !== componentId));
  };

  const handleUpdateQuantity = (componentId, quantity) => {
    setComponents(components.map(c => 
      c.component_id === componentId 
        ? { ...c, quantity_per_unit: parseFloat(quantity) || 0 }
        : c
    ));
  };

  const usedComponentIds = components.map(c => c.component_id);
  const availableForAdd = availableComponents.filter(c => 
    !usedComponentIds.includes(c.id)
  );

  const totalWeight = components.reduce((sum, c) => sum + (c.quantity_per_unit || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka
        </Button>
      </div>

      {/* Product Selection */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          {recipe ? 'Redigera recept' : 'Skapa nytt recept'}
        </h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Välj färdigvara *</Label>
            <Select 
              value={selectedProduct} 
              onValueChange={setSelectedProduct}
              disabled={!!recipe}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj färdigvara..." />
              </SelectTrigger>
              <SelectContent>
                {finishedGoods.map(fg => (
                  <SelectItem key={fg.id} value={fg.id}>
                    {fg.sku} - {fg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {finishedGoods.length === 0 && (
              <p className="text-sm text-amber-600">
                Inga färdigvaror finns. Skapa en färdigvara först i Produkter-sidan.
              </p>
            )}
          </div>

          {selectedProductData && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Enhet: <strong>{selectedProductData.unit}</strong> - 
                Ange hur mycket av varje komponent som behövs per 1 {selectedProductData.unit} färdigvara.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      {/* Components List */}
      {selectedProduct && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Komponenter i receptet</h3>
            {totalWeight > 0 && (
              <Badge variant="outline">
                Total: {totalWeight.toFixed(3)} {selectedProductData?.unit}
              </Badge>
            )}
          </div>

          {components.length > 0 ? (
            <Table className="mb-4">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Komponent</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="w-[180px]">Mängd per 1 {selectedProductData?.unit}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((comp) => (
                  <TableRow key={comp.component_id}>
                    <TableCell className="font-mono text-sm">{comp.component_sku}</TableCell>
                    <TableCell className="font-medium">{comp.component_name}</TableCell>
                    <TableCell>
                      <Badge className={cn(typeColors[comp.component_type], "font-normal")}>
                        {typeLabels[comp.component_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={comp.quantity_per_unit}
                          onChange={(e) => handleUpdateQuantity(comp.component_id, e.target.value)}
                          className="w-28"
                        />
                        <span className="text-sm text-slate-500">{comp.component_unit}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveComponent(comp.component_id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p>Inga komponenter tillagda än</p>
              <p className="text-sm mt-1">Lägg till komponenter nedan</p>
            </div>
          )}

          {/* Add Component */}
          {availableForAdd.length > 0 && (
            <div className="flex items-end gap-3 p-4 bg-slate-50 rounded-lg">
              <div className="flex-1 space-y-2">
                <Label>Lägg till komponent</Label>
                <Select 
                  value={newComponent.component_id} 
                  onValueChange={(v) => setNewComponent({ ...newComponent, component_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj komponent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableForAdd.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{c.sku}</span>
                          <span>-</span>
                          <span>{c.name}</span>
                          <span className="text-slate-500">({c.unit})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-2">
                <Label>Mängd per 1 {selectedProductData?.unit}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={newComponent.quantity_per_unit}
                  onChange={(e) => setNewComponent({ ...newComponent, quantity_per_unit: e.target.value })}
                  placeholder="0"
                />
              </div>
              <Button 
                onClick={handleAddComponent}
                disabled={!newComponent.component_id || !newComponent.quantity_per_unit}
              >
                <Plus className="w-4 h-4 mr-2" />
                Lägg till
              </Button>
            </div>
          )}

          {availableForAdd.length === 0 && components.length > 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              Alla tillgängliga komponenter har lagts till
            </p>
          )}
        </Card>
      )}

      {/* Actions */}
      {selectedProduct && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button 
            onClick={() => saveRecipeMutation.mutate()}
            disabled={!selectedProduct || components.length === 0 || saveRecipeMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveRecipeMutation.isPending ? 'Sparar...' : 'Spara recept'}
          </Button>
        </div>
      )}
    </div>
  );
}