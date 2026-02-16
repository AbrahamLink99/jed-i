import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, AlertTriangle, CheckCircle2, Droplets } from 'lucide-react';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';

export default function FillingPage() {
  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();
  
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [lines, setLines] = useState([]);
  const [waste, setWaste] = useState([]);
  const [bulkWasteKg, setBulkWasteKg] = useState(0);
  const [preview, setPreview] = useState(null);
  const [receipt, setReceipt] = useState(null);

  // Fetch available mix batches
  const { data: mixBatches = [] } = useQuery({
    queryKey: ['mixBatches', envFilter.environment],
    queryFn: async () => {
      const batches = await base44.entities.MixBatch.filter({ 
        status: 'available',
        environment: envFilter.environment
      });
      // sortera nyaste först
      return batches.filter(b => b.remaining_kg > 0).sort((a,b) => (b.produced_at || '').localeCompare(a.produced_at || ''));
    }
  });

  // Fetch packaging recipes for selected batch
  const { data: recipes = [] } = useQuery({
    queryKey: ['packagingRecipes', selectedBatchId, envFilter.environment],
    queryFn: async () => {
      if (!selectedBatchId) return [];
      const batch = mixBatches.find(b => b.id === selectedBatchId);
      if (!batch) return [];
      return await base44.entities.PackagingRecipe.filter({
        mix_sku: batch.mix_sku,
        active: true,
        environment: envFilter.environment
      });
    },
    enabled: !!selectedBatchId
  });

  // Initialize lines when recipes are loaded
  useEffect(() => {
    if (recipes.length > 0 && lines.length === 0) {
      setLines(recipes.map(r => ({
        finished_sku: r.finished_sku,
        finished_name: r.finished_name,
        produced_units: 0
      })));
    }
  }, [recipes]);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (vars) => {
      const response = await base44.functions.invoke('computeFillingReportPreview', {
        mix_batch_id: vars.mix_batch_id,
        lines: vars.lines,
        waste: vars.waste,
        bulk_waste_kg: vars.bulk_waste_kg
      });
      return response.data;
    },
    onSuccess: (data) => {
      setPreview(data);
    }
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: async (vars) => {
      const response = await base44.functions.invoke('completeFillingReport', {
        mix_batch_id: vars.mix_batch_id,
        lines: vars.lines,
        waste: vars.waste,
        bulk_waste_kg: vars.bulk_waste_kg
      });
      return response.data;
    },
    onSuccess: (data) => {
      setReceipt(data.receipt);
      queryClient.invalidateQueries(['mixBatches']);
      queryClient.invalidateQueries(['inventoryLedger']);
    }
  });

  // Auto-preview when data changes
  useEffect(() => {
    if (!selectedBatchId || !lines.some(l => l.produced_units > 0)) {
      setPreview(null);
      return;
    }
    const h = setTimeout(() => {
      previewMutation.mutate({
        mix_batch_id: selectedBatchId,
        lines: lines.filter(l => l.produced_units > 0),
        waste,
        bulk_waste_kg: parseFloat(bulkWasteKg) || 0
      });
    }, 400);
    return () => clearTimeout(h);
  }, [selectedBatchId, lines, waste, bulkWasteKg]);

  const handleLineChange = (index, value) => {
    const newLines = [...lines];
    newLines[index].produced_units = parseInt(value) || 0;
    setLines(newLines);
  };

  const addWaste = () => {
    setWaste([...waste, { component_sku: '', component_name: '', waste_qty: 0 }]);
  };

  const updateWaste = (index, field, value) => {
    const newWaste = [...waste];
    newWaste[index][field] = field === 'waste_qty' ? (parseInt(value) || 0) : value;
    setWaste(newWaste);
  };

  const removeWaste = (index) => {
    setWaste(waste.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (!selectedBatchId) return;
    if (!lines.some(l => l.produced_units > 0)) {
      alert('Fyll i minst en variant');
      return;
    }
    completeMutation.mutate({
      mix_batch_id: selectedBatchId,
      lines: lines.filter(l => l.produced_units > 0),
      waste,
      bulk_waste_kg: parseFloat(bulkWasteKg) || 0
    });
  };

  const resetForm = () => {
    setSelectedBatchId('');
    setLines([]);
    setWaste([]);
    setBulkWasteKg(0);
    setPreview(null);
    setReceipt(null);
  };

  if (receipt) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <CardTitle>Tappning slutförd!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Batch</p>
                <p className="font-semibold">{receipt.batch_no}</p>
              </div>
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
                    <span>{line.finished_name}</span>
                    <span className="font-semibold">{line.produced_units} st</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Komponenter förbrukade</h3>
              <div className="space-y-2">
                {receipt.components_used.map((comp, i) => (
                  <div key={i} className="flex justify-between p-2 bg-slate-50 rounded">
                    <span>{comp.component_name}</span>
                    <span className="font-semibold">{comp.qty_used} st</span>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={resetForm} className="w-full">
              Ny tappning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5" />
            Ny tappning
          </CardTitle>
          <CardDescription>
           Registrera tappning/packning från en tillverkad blandning. Endast blandningar (MixBatch) med status Tillgänglig visas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mixBatches.length === 0 && (
            <Alert>
              <AlertDescription>
                Inga blandningsbatcher tillgängliga i {envFilter.environment}. Skapa en blandning via Produktion (aktivera "Blandning (bulk)") och säkerställ att tappningsrecept finns för mixens SKU.
              </AlertDescription>
              <div className="mt-3">
                <Button asChild variant="outline" size="sm">
                  <Link to={createPageUrl('Production')}>Gå till Produktion</Link>
                </Button>
              </div>
            </Alert>
          )}
          {/* Batch selection */}
          <div className="space-y-2">
            <Label>Välj blandningsbatch</Label>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj batch..." />
              </SelectTrigger>
              <SelectContent>
               {mixBatches.length === 0 ? (
                 <SelectItem value={null} disabled>Inga blandningsbatcher</SelectItem>
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

          {selectedBatchId && recipes.length > 0 && (
            <>
              {/* Production lines */}
              <div className="space-y-3">
                <Label>Producerade varor</Label>
                {lines.map((line, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input
                        value={line.finished_name}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        placeholder="Antal"
                        value={line.produced_units || ''}
                        onChange={(e) => handleLineChange(index, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bulk waste */}
              <div className="space-y-2">
                <Label>Bulk spill (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={bulkWasteKg || ''}
                  onChange={(e) => setBulkWasteKg(e.target.value)}
                />
              </div>

              {/* Waste/spillage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Komponentspill</Label>
                  <Button variant="outline" size="sm" onClick={addWaste}>
                    Lägg till spill
                  </Button>
                </div>
                {waste.map((w, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="SKU"
                      value={w.component_sku}
                      onChange={(e) => updateWaste(index, 'component_sku', e.target.value)}
                    />
                    <Input
                      placeholder="Namn"
                      value={w.component_name}
                      onChange={(e) => updateWaste(index, 'component_name', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Antal"
                      value={w.waste_qty || ''}
                      onChange={(e) => updateWaste(index, 'waste_qty', e.target.value)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWaste(index)}
                    >
                      Ta bort
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Preview */}
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
                  <p className="text-xs text-slate-500">Beräknat som (ml per enhet × antal) / 1000 + bulkspill</p>
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

              {preview.components_used.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Komponenter</p>
                  <div className="space-y-1">
                    {preview.components_used.map((comp, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{comp.component_name}</span>
                        <span className="font-medium">{comp.qty_used} st</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  {preview.warnings.map((warning, i) => (
                    <Alert key={i} variant={warning.type === 'error' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{warning.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {selectedBatchId && (
            <div className="flex gap-3">
              <Button
                onClick={handleComplete}
                disabled={!preview || preview.warnings.some(w => w.type === 'error') || completeMutation.isPending}
                className="flex-1"
              >
                {completeMutation.isPending ? 'Bearbetar...' : 'Slutför tappning'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Rensa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}