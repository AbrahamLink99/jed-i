import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function FillingTab({ selectedMixBatchId, onCompleted }) {
  const queryClient = useQueryClient();

  const { data: mixBatch } = useQuery({
    queryKey: ['mixBatch', selectedMixBatchId],
    enabled: !!selectedMixBatchId,
    queryFn: async () => {
      const all = await base44.entities.MixBatch.filter({});
      return (all || []).find(b => b.id === selectedMixBatchId);
    }
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['packaging-recipes', mixBatch?.mix_sku],
    enabled: !!mixBatch?.mix_sku,
    queryFn: () => base44.entities.PackagingRecipe.filter({ mix_sku: mixBatch.mix_sku, active: true })
  });

  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!recipes?.length) return;
    setLines(recipes.map(r => ({ finished_sku: r.finished_sku, produced_units: '', batch_number: '' })));
  }, [recipes]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        mix_batch_id: selectedMixBatchId,
        lines: lines
          .filter(l => Number(l.produced_units) > 0)
          .map(l => ({ finished_sku: l.finished_sku, produced_units: Number(l.produced_units), batch_number: (l.batch_number||'').trim() })),
        waste: [],
        bulk_waste_kg: 0
      };
      const res = await base44.functions.invoke('completeFillingReport', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mixBatches'] });
      queryClient.invalidateQueries({ queryKey: ['finished-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryLedger'] });
      onCompleted?.();
    }
  });

  const handleChange = (idx, field, value) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  if (!selectedMixBatchId) {
    return <Card className="p-6">Välj en blandning i fliken "Färdiga blandningar" för att tappa.</Card>;
  }

  if (!mixBatch) {
    return <Card className="p-6">Laddar batch...</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs text-slate-500">Mix SKU</div>
            <div className="font-mono font-medium">{mixBatch.mix_sku}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Batch</div>
            <div className="font-mono font-medium">{mixBatch.batch_no}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-500">Producerad / Kvar (kg)</div>
            <div className="font-semibold">{mixBatch.produced_kg?.toLocaleString('sv-SE')} / {mixBatch.remaining_kg?.toLocaleString('sv-SE')}</div>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>finished_sku</TableHead>
              <TableHead className="text-right">Antal</TableHead>
              <TableHead>Batchnummer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, idx) => (
              <TableRow key={l.finished_sku}>
                <TableCell className="font-mono text-sm">{l.finished_sku}</TableCell>
                <TableCell className="text-right">
                  <Input type="number" min="0" step="1" value={l.produced_units}
                         onChange={(e) => handleChange(idx, 'produced_units', e.target.value)}
                         className="w-28 ml-auto" />
                </TableCell>
                <TableCell>
                  <Input type="text" value={l.batch_number}
                         onChange={(e) => handleChange(idx, 'batch_number', e.target.value)}
                         placeholder="Valfritt – auto om tomt" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
          {completeMutation.isPending ? 'Slutför...' : 'Slutför tappning'}
        </Button>
      </div>
    </div>
  );
}