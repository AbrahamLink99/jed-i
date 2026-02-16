import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Plus, Trash2, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useEnvironmentFilter } from "@/components/environment/useEnvironmentFilter";

export default function PackagingRecipeForm({ recipe, availableProducts = [], onClose }) {
  const envFilter = useEnvironmentFilter();
  const queryClient = useQueryClient();

  const [mixProductId, setMixProductId] = useState(() => {
    if (recipe?.mix_sku) {
      const p = availableProducts.find(p => p.sku === recipe.mix_sku);
      return p?.id || '';
    }
    return '';
  });
  const [finishedProductId, setFinishedProductId] = useState(() => {
    if (recipe?.finished_sku) {
      const p = availableProducts.find(p => p.sku === recipe.finished_sku);
      return p?.id || '';
    }
    return '';
  });
  const [fillMl, setFillMl] = useState(recipe?.fill_ml_per_unit || '');
  const [active, setActive] = useState(recipe?.active ?? true);

  const packagingCandidates = useMemo(() => (
    availableProducts.filter(p => p.type === 'packaging' || p.type === 'label')
  ), [availableProducts]);

  const finishedGoods = useMemo(() => (
    availableProducts.filter(p => p.type === 'finished_good')
  ), [availableProducts]);

  const mixCandidates = useMemo(() => (
    // Visa alla produkter att välja som mix-källa (vanligtvis bulk/färdigvara som tappas)
    availableProducts.filter(p => p.active !== false)
  ), [availableProducts]);

  const [components, setComponents] = useState(() => recipe?.components?.map(c => ({
    component_sku: c.component_sku,
    component_name: c.component_name,
    qty_per_unit: c.qty_per_unit
  })) || []);

  const usedSkus = components.map(c => c.component_sku);
  const addableComponents = packagingCandidates.filter(p => !usedSkus.includes(p.sku));

  const [newComp, setNewComp] = useState({ id: '', qty: '' });

  const selectedMix = availableProducts.find(p => p.id === mixProductId);
  const selectedFinished = availableProducts.find(p => p.id === finishedProductId);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!mixProductId || !finishedProductId || !fillMl) {
        throw new Error('Välj mix, färdigvara och fyllmängd');
      }
      const mixSku = selectedMix.sku;
      const finishedSku = selectedFinished.sku;
      const payload = {
        environment: envFilter.environment,
        mix_sku: mixSku,
        finished_sku: finishedSku,
        finished_name: selectedFinished.name,
        fill_ml_per_unit: parseFloat(fillMl),
        components: components.map(c => ({
          component_sku: c.component_sku,
          component_name: c.component_name,
          qty_per_unit: parseFloat(c.qty_per_unit)
        })),
        active
      };

      if (recipe?.id) {
        const { environment, ...rest } = payload; // behåll befintlig env vid update
        await base44.entities.PackagingRecipe.update(recipe.id, rest);
      } else {
        await base44.entities.PackagingRecipe.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-recipes-entities'] });
      toast.success('Tappningsrecept sparat');
      onClose();
    },
    onError: (e) => {
      toast.error('Kunde inte spara: ' + (e?.message || 'okänt fel'));
    }
  });

  const addComponent = () => {
    if (!newComp.id || !newComp.qty) return;
    const prod = packagingCandidates.find(p => p.id === newComp.id);
    if (!prod) return;
    setComponents(prev => ([
      ...prev,
      { component_sku: prod.sku, component_name: prod.name, qty_per_unit: parseFloat(newComp.qty) }
    ]));
    setNewComp({ id: '', qty: '' });
  };

  const removeComponent = (sku) => {
    setComponents(prev => prev.filter(c => c.component_sku !== sku));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Tillbaka
          </Button>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" /> {recipe ? 'Redigera tappningsrecept' : 'Skapa tappningsrecept'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Blandning (mix) *</Label>
              <Select value={mixProductId} onValueChange={setMixProductId} disabled={!!recipe}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj mix..." />
                </SelectTrigger>
                <SelectContent>
                  {mixCandidates.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-sm">{p.sku}</span> - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Detta är den producerade blandningen som tappas.</p>
            </div>

            <div className="space-y-2">
              <Label>Färdig variant *</Label>
              <Select value={finishedProductId} onValueChange={setFinishedProductId} disabled={!!recipe}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj färdigvariant..." />
                </SelectTrigger>
                <SelectContent>
                  {finishedGoods.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-sm">{p.sku}</span> - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Varje storlek/doft är en egen färdigvara (unik SKU).</p>
            </div>

            <div className="space-y-2">
              <Label>Fyllmängd per enhet (ml) *</Label>
              <Input type="number" step="1" value={fillMl} onChange={(e) => setFillMl(e.target.value)} placeholder="t.ex. 250" />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2 text-sm">
                <input id="active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <Label htmlFor="active">Aktiv</Label>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Förpackningskomponenter</h3>
            <Badge variant="outline">{components.length} st</Badge>
          </div>

          {components.length === 0 && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Lägg till flaskor, korkar, etiketter m.m. med antal per enhet.</AlertDescription>
            </Alert>
          )}

          {components.length > 0 && (
            <Table className="mb-4">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Komponent</TableHead>
                  <TableHead className="w-[180px]">Antal per enhet</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((c) => (
                  <TableRow key={c.component_sku}>
                    <TableCell className="font-mono text-sm">{c.component_sku}</TableCell>
                    <TableCell>{c.component_name}</TableCell>
                    <TableCell>{c.qty_per_unit}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => removeComponent(c.component_sku)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {addableComponents.length > 0 && (
            <div className="flex items-end gap-3 p-4 bg-slate-50 rounded-lg">
              <div className="flex-1 space-y-2">
                <Label>Lägg till komponent</Label>
                <Select value={newComp.id} onValueChange={(v) => setNewComp({ ...newComp, id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj komponent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {addableComponents.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-sm">{p.sku}</span> - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-2">
                <Label>Antal</Label>
                <Input type="number" min="0" step="0.001" value={newComp.qty} onChange={(e) => setNewComp({ ...newComp, qty: e.target.value })} placeholder="1" />
              </div>
              <Button onClick={addComponent} disabled={!newComp.id || !newComp.qty}>
                <Plus className="w-4 h-4 mr-2" /> Lägg till
              </Button>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !mixProductId || !finishedProductId || !fillMl}>
            <Save className="w-4 h-4 mr-2" /> {saveMutation.isPending ? 'Sparar...' : 'Spara recept'}
          </Button>
        </div>
      </div>
    </div>
  );
}