import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Droplets, Package, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { generateBatchNumber } from '@/components/inventory/StockCalculations';

export default function FillingPage() {
  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();

  // Step 1: Välj MixBatch (remaining_kg > 0)
  const { data: mixBatches = [] } = useQuery({
    queryKey: ['mixBatches', envFilter.environment],
    queryFn: async () => {
      const batches = await base44.entities.MixBatch.filter({
        environment: envFilter.environment,
        status: 'available',
      }, '-created_date', 200);
      return batches.filter(b => (b.remaining_kg ?? 0) > 0)
        .sort((a, b) => (b.produced_at || '').localeCompare(a.produced_at || ''));
    }
  });

  // Reference data
  const { data: products = [] } = useQuery({
    queryKey: ['products', envFilter.environment],
    queryFn: () => base44.entities.Product.filter(envFilter, undefined, 1000)
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items', envFilter.environment],
    queryFn: () => base44.entities.BOMItem.filter(envFilter, undefined, 5000)
  });

  // PackagingRecipe är valfri (ej hårt krav)
  const { data: packagingRecipes = [] } = useQuery({
    queryKey: ['packaging-recipes', envFilter.environment],
    queryFn: () => base44.entities.PackagingRecipe.filter(envFilter, undefined, 1000)
  });

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const selectedBatch = mixBatches.find(b => b.id === selectedBatchId);

  // Step 2: Sökbar multi-select med finished goods som matchar blandningens BOM-ingredienser (om känt)
  const finishedProducts = useMemo(() => products.filter(p => p.type === 'finished_good' && p.active !== false), [products]);

  // BOM-signatur per finished product (bara ingrediensuppsättning, inte kvantiteter)
  const bomSignatureByFinishedId = useMemo(() => {
    const map = new Map();
    finishedProducts.forEach(fp => {
      const items = bomItems.filter(b => b.finished_product_id === fp.id);
      const sig = Array.from(new Set(items.map(i => i.component_id))).sort().join('|');
      map.set(fp.id, sig);
    });
    return map;
  }, [finishedProducts, bomItems]);

  // Försök härleda blandningens BOM-signatur via valfri PackagingRecipe (om finns). Om saknas -> null
  const mixSignature = useMemo(() => {
    if (!selectedBatch) return null;
    const anyRecipe = (packagingRecipes || []).find(r => r.mix_sku === selectedBatch.mix_sku);
    if (!anyRecipe) return null;
    const finished = finishedProducts.find(p => p.sku === anyRecipe.finished_sku);
    if (!finished) return null;
    return bomSignatureByFinishedId.get(finished.id) || null;
  }, [selectedBatch, packagingRecipes, finishedProducts, bomSignatureByFinishedId]);

  const candidateFinished = useMemo(() => {
    if (!mixSignature) return finishedProducts; // om okänd signatur, visa alla
    return finishedProducts.filter(fp => (bomSignatureByFinishedId.get(fp.id) || '') === mixSignature);
  }, [finishedProducts, bomSignatureByFinishedId, mixSignature]);

  // Fyllvolym per enhet via PackagingRecipe för aktuell mix (kan saknas)
  const fillMlByFinishedSku = useMemo(() => {
    const map = {};
    if (!selectedBatch) return map;
    (packagingRecipes || [])
      .filter(r => r.mix_sku === selectedBatch.mix_sku)
      .forEach(r => { map[r.finished_sku] = r.fill_ml_per_unit; });
    return map;
  }, [selectedBatch, packagingRecipes]);

  // Multi-select dialog
  const [multiOpen, setMultiOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]); // array av product.id

  const toggleProduct = (pid) => {
    setSelectedProductIds(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  // Step 3: För varje vald artikel – per-rad data
  const [lines, setLines] = useState([]);

  // Synka lines med valda produkter
  useEffect(() => {
    const next = selectedProductIds.map(pid => {
      const p = products.find(x => x.id === pid);
      const existing = lines.find(l => l.finished_product_id === pid);
      return existing || {
        finished_product_id: pid,
        finished_sku: p?.sku,
        finished_name: p?.name,
        produced_units: 0,
        batch_number: '',
        waste_kg: '' // valfritt
      };
    });
    setLines(next);
  }, [selectedProductIds, products]);

  const onLineChange = (idx, field, value) => {
    setLines(prev => prev.map((l, i) => i === idx ? {
      ...l,
      [field]: field === 'produced_units' ? (parseInt(value) || 0) : (field === 'waste_kg' ? (value === '' ? '' : parseFloat(value) || 0) : value)
    } : l));
  };

  // Preview-beräkning klient-side
  const preview = useMemo(() => {
    if (!selectedBatch) return null;
    const unitsBulkKg = lines.reduce((sum, l) => {
      const ml = fillMlByFinishedSku[l.finished_sku];
      if (!ml) return sum; // ingen volym -> ingen automatisk bulkförbrukning
      const perUnitKg = (ml || 0) / 1000;
      return sum + (l.produced_units || 0) * perUnitKg;
    }, 0);
    const spillKg = lines.reduce((sum, l) => sum + ((typeof l.waste_kg === 'number' ? l.waste_kg : 0) || 0), 0);
    const bulk_used_kg = +(unitsBulkKg + spillKg).toFixed(3);
    const remaining_kg_after = +(((selectedBatch.remaining_kg || 0) - bulk_used_kg).toFixed(3));
    const warnings = [];
    if (remaining_kg_after < 0) {
      warnings.push({ type: 'error', message: 'Förbrukningen överstiger kvarvarande bulk.' });
    }
    return {
      bulk_used_kg,
      remaining_kg_after,
      warnings
    };
  }, [selectedBatch, lines, fillMlByFinishedSku]);

  // Bekräfta: skapa Batch + Ledger per variant, uppdatera MixBatch.remaining_kg
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBatch) throw new Error('Ingen blandningsbatch vald');

      // Skapa batches + ledger
      const createdLines = [];
      for (const l of lines) {
        const units = l.produced_units || 0;
        if (units <= 0) continue;
        const p = products.find(x => x.id === l.finished_product_id);
        if (!p) continue;

        const bn = (l.batch_number && l.batch_number.trim()) ? l.batch_number.trim() : generateBatchNumber(p.sku);

        const batch = await base44.entities.Batch.create({
          environment: envFilter.environment,
          batch_number: bn,
          product_id: p.id,
          product_sku: p.sku,
          product_name: p.name,
          produced_quantity: units,
          current_quantity: units,
          production_date: new Date().toISOString().split('T')[0],
          status: 'available',
          notes: `Tappning från ${selectedBatch.batch_no}`
        });

        await base44.entities.InventoryLedger.create({
          environment: envFilter.environment,
          product_id: p.id,
          product_sku: p.sku,
          product_name: p.name,
          batch_number: bn,
          transaction_type: 'production',
          quantity: units,
          reference: `Tappning från ${selectedBatch.batch_no}`,
          notes: `${units} st`
        });

        createdLines.push({
          finished_name: p.name,
          finished_sku: p.sku,
          produced_units: units,
          batch_number: bn
        });
      }

      // Uppdatera MixBatch remaining_kg (räkna enligt preview)
      const bulk_used_kg = preview?.bulk_used_kg || 0;
      const newRemaining = Math.max(0, (selectedBatch.remaining_kg || 0) - bulk_used_kg);
      await base44.entities.MixBatch.update(selectedBatch.id, {
        remaining_kg: +newRemaining.toFixed(3),
        status: newRemaining <= 0.0005 ? 'depleted' : selectedBatch.status
      });

      return {
        receipt: {
          mix_batch_no: selectedBatch.batch_no,
          total_units: createdLines.reduce((a, b) => a + (b.produced_units || 0), 0),
          bulk_used_kg: preview?.bulk_used_kg || 0,
          remaining_kg: +newRemaining.toFixed(3),
          lines: createdLines
        }
      };
    },
    onSuccess: (data) => {
      setReceipt(data.receipt);
      queryClient.invalidateQueries({ queryKey: ['mixBatches'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    }
  });

  const [receipt, setReceipt] = useState(null);
  const resetForm = () => {
    setSelectedBatchId('');
    setSelectedProductIds([]);
    setLines([]);
    setReceipt(null);
  };

  // ————— Receipt UI —————
  if (receipt) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <CardTitle>Tappning slutförd!</CardTitle>
            </div>
            <CardDescription>Mixbatch: {receipt.mix_batch_no}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Totalt producerat</p>
                <p className="font-semibold">{receipt.total_units} enheter</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Bulk förbrukad</p>
                <p className="font-semibold">{receipt.bulk_used_kg} kg</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Kvarvarande bulk</p>
                <p className="font-semibold">{receipt.remaining_kg} kg</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Producerade varor</h3>
              <div className="space-y-2">
                {receipt.lines.map((line, i) => (
                  <div key={i} className="flex justify-between p-2 bg-slate-50 rounded">
                    <div>
                      <span>{line.finished_name}</span>
                      {line.batch_number && (
                        <p className="text-xs text-slate-500">Batch: {line.batch_number}</p>
                      )}
                    </div>
                    <span className="font-semibold">{line.produced_units} st</span>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={resetForm} className="w-full">Ny tappning</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ————— Main UI —————
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5" />
            Ny tappning
          </CardTitle>
          <CardDescription>
            Registrera tappning/packning från en tillverkad blandning. Endast blandningar (MixBatch) med kvarvarande mängd visas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steg 1 – Välj blandningsbatch */}
          <div className="space-y-2">
            <Label>Välj blandningsbatch</Label>
            <Select value={selectedBatchId} onValueChange={(v) => { setSelectedBatchId(v); setSelectedProductIds([]); setLines([]); }}>
              <SelectTrigger>
                <SelectValue placeholder="Välj batch..." />
              </SelectTrigger>
              <SelectContent>
                {mixBatches.length === 0 ? (
                  <SelectItem value="none" disabled>Inga blandningsbatcher</SelectItem>
                ) : (
                  mixBatches.map(batch => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.mix_sku} - {batch.batch_no} ({batch.remaining_kg} kg kvar)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Steg 2 – Sökbar multi-select */}
          {selectedBatch && (
            <div className="space-y-2">
              <Label>Välj färdiga artiklar</Label>
              <div className="flex gap-2 items-center flex-wrap">
                {selectedProductIds.map(pid => {
                  const p = products.find(x => x.id === pid);
                  if (!p) return null;
                  return (
                    <Badge key={pid} variant="secondary" className="flex items-center gap-2">
                      {p.name} <span className="text-xs text-slate-500">({p.sku})</span>
                      <button className="text-slate-500 hover:text-slate-700" onClick={() => toggleProduct(pid)}>×</button>
                    </Badge>
                  );
                })}
                <Button type="button" variant="outline" onClick={() => setMultiOpen(true)} className="gap-2">
                  <Search className="w-4 h-4" /> Välj artiklar
                </Button>
              </div>

              <CommandDialog open={multiOpen} onOpenChange={setMultiOpen}>
                <Command>
                  <CommandInput placeholder="Sök artiklar..." />
                  <CommandList>
                    <CommandEmpty>Inget hittat.</CommandEmpty>
                    <CommandGroup heading="Artiklar">
                      {candidateFinished.map(fp => (
                        <CommandItem key={fp.id} onSelect={() => toggleProduct(fp.id)} className="flex items-center gap-2">
                          <Checkbox checked={selectedProductIds.includes(fp.id)} readOnly />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{fp.name}</div>
                            <div className="text-xs text-slate-500">{fp.sku}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </CommandDialog>
            </div>
          )}

          {/* Steg 3 – Per-variant inmatning */}
          {selectedBatch && lines.length > 0 && (
            <div className="space-y-3">
              <Label>Producerade varor</Label>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <Input value={`${line.finished_name || ''}`} disabled className="bg-slate-50 md:col-span-5" />
                  <Input
                    type="number"
                    placeholder="Antal"
                    value={line.produced_units || ''}
                    onChange={(e) => onLineChange(idx, 'produced_units', e.target.value)}
                    className="md:col-span-2"
                  />
                  <Input
                    type="text"
                    placeholder="Batchnr (valfritt)"
                    value={line.batch_number || ''}
                    onChange={(e) => onLineChange(idx, 'batch_number', e.target.value)}
                    className="md:col-span-3"
                  />
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="Spill (kg)"
                    value={line.waste_kg === '' ? '' : line.waste_kg}
                    onChange={(e) => onLineChange(idx, 'waste_kg', e.target.value)}
                    className="md:col-span-2"
                  />
                </div)
              ))}
            </div>
          )}

          {/* Steg 4 – Förhandsvisning & Bekräfta */}
          {selectedBatch && (
            <>
              {preview && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Sammanfattning
                  </h3>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Bulk förbrukad</p>
                      <p className="font-semibold">{preview.bulk_used_kg} kg</p>
                      <p className="text-xs text-slate-500">(ml/enhet × antal) / 1000 + spill</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Kvarvarande</p>
                      <p className="font-semibold">{preview.remaining_kg_after} kg</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Status</p>
                      <Badge variant={preview.remaining_kg_after >= 0 ? 'default' : 'destructive'}>
                        {preview.remaining_kg_after >= 0 ? 'OK' : 'Ej tillräckligt'}
                      </Badge>
                    </div>
                  </div>

                  {preview.warnings.length > 0 && (
                    <div className="space-y-2">
                      {preview.warnings.map((w, i) => (
                        <Alert key={i} variant={w.type === 'error' ? 'destructive' : 'default'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{w.message}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => completeMutation.mutate()}
                  disabled={!selectedBatch || completeMutation.isPending || (preview && preview.remaining_kg_after < 0)}
                  className="flex-1"
                >
                  {completeMutation.isPending ? 'Bearbetar...' : 'Slutför tappning'}
                </Button>
                <Button variant="outline" onClick={resetForm}>Rensa</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}