import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Factory, CheckCircle } from 'lucide-react';
import ProductionForm from '@/components/production/ProductionForm';
import MixBatchList from '@/components/production/MixBatchList';
import FillingTab from '@/components/production/FillingTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateBatchNumber, getStockSummary } from '@/components/inventory/StockCalculations';
import { toast } from 'sonner';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';

export default function Production() {
  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();

  const { data: products = [], error: productsError } = useQuery({
    queryKey: ['products', envFilter.environment],
    queryFn: () => base44.entities.Product.filter(envFilter),
    onError: (e) => console.error('Failed to load products', e)
  });

  useEffect(() => {
    if (productsError) {
      console.error('useQuery products error:', productsError);
    }
  }, [productsError]);

  const { data: bomItems = [], error: bomError } = useQuery({
    queryKey: ['bom-items', envFilter.environment],
    queryFn: () => base44.entities.BOMItem.filter(envFilter),
  });

  useEffect(() => {
    if (bomError) {
      console.error('useQuery BOM items error:', bomError);
    }
  }, [bomError]);

  const { data: packagingRecipes = [] } = useQuery({
    queryKey: ['packaging-recipes', envFilter.environment],
    queryFn: () => base44.entities.PackagingRecipe.filter(envFilter)
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches', envFilter.environment],
    queryFn: () => base44.entities.Batch.filter(envFilter, '-created_date', 20)
  });

  const { data: mixBatches = [] } = useQuery({
    queryKey: ['mixBatches', envFilter.environment],
    queryFn: () => base44.entities.MixBatch.filter(envFilter, '-created_date', 100)
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger', envFilter.environment],
    queryFn: () => base44.entities.InventoryLedger.filter(envFilter, '-created_date', 500)
  });

  const finishedProducts = products.filter(p => p.type === 'finished_good' && p.active !== false);

  // Produkter som är godkända som blandningar (har tappningsrecept)
  const recipeOptions = useMemo(() => {
    const activeRecipes = (packagingRecipes || []).filter(r => r.active);
    const byMix = new Map();
    activeRecipes.forEach(r => {
      if (!byMix.has(r.mix_sku)) byMix.set(r.mix_sku, []);
      byMix.get(r.mix_sku).push(r);
    });

    const opts = [];
    byMix.forEach((recipes, mixSku) => {
      const finishedSku = recipes[0]?.finished_sku;
      const finishedProduct = products.find(p => p.sku === finishedSku);
      const mixProduct = products.find(p => p.sku === mixSku);
      const bomForFinished = finishedProduct ? bomItems.filter(b => b.finished_product_id === finishedProduct.id) : [];
      if (!bomForFinished.length) return; // only show recipes that have a BOM
      const label = mixProduct?.name || finishedProduct?.name || mixSku;
      const enrichedBOM = bomForFinished.map(b => {
        const component = products.find(p => p.id === b.component_id);
        return { ...b, component_sku: component?.sku, component_name: component?.name, component_unit: component?.unit };
      });
      opts.push({ mix_sku: mixSku, label, mix_product_id: mixProduct?.id, mix_product: mixProduct, finished_product_id: finishedProduct?.id, bom: enrichedBOM });
    });

    // Deduplicate by BOM signature so identical recipes appear once
    const bySig = new Map();
    for (const o of opts) {
      const sig = JSON.stringify(o.bom.map(b => ({ c: b.component_id, q: b.quantity_per_unit })).sort((a,b)=> a.c.localeCompare(b.c)));
      if (!bySig.has(sig)) {
        bySig.set(sig, o);
      }
    }
    return Array.from(bySig.values());
  }, [packagingRecipes, products, bomItems]);

  const bomWithNames = useMemo(() => {
    return bomItems.map(bom => {
      const component = products.find(p => p.id === bom.component_id);
      return {
        ...bom,
        component_sku: component?.sku,
        component_name: component?.name,
        component_unit: component?.unit
      };
    });
  }, [bomItems, products]);

  const componentStock = useMemo(() => {
    const stock = {};
    products.forEach(p => {
      const summary = getStockSummary(p, ledger, batches);
      stock[p.id] = summary.onHand;
    });
    return stock;
  }, [products, ledger, batches]);

  const productionMutation = useMutation({
    mutationFn: async (data) => {
      const { mixSku, mixProductId, mixProduct, quantity, productionDate, notes, componentImpact, batchNumber } = data;

      const finalBatchNo = (batchNumber && batchNumber.trim()) ? batchNumber.trim() : generateBatchNumber(mixSku);

      // 1. Create MixBatch (always)
      const mix = await base44.entities.MixBatch.create({
        environment: envFilter.environment,
        mix_sku: mixSku,
        batch_no: finalBatchNo,
        produced_kg: quantity,
        remaining_kg: quantity,
        status: 'available',
        produced_at: new Date().toISOString(),
        notes
      });

      // 2. Ledger entry for mix production (bulk in)
      await base44.entities.InventoryLedger.create({
        environment: envFilter.environment,
        product_id: mixProductId,
        product_sku: mixSku,
        product_name: mixProduct?.name,
        batch_number: finalBatchNo,
        transaction_type: 'production',
        quantity: quantity,
        reference: `Blandning: ${finalBatchNo}`,
        notes
      });

      // 3. Backflush raw materials
      for (const impact of componentImpact) {
        await base44.entities.InventoryLedger.create({
          environment: envFilter.environment,
          product_id: impact.component_id,
          product_sku: impact.component_sku,
          product_name: impact.component_name,
          batch_number: finalBatchNo,
          transaction_type: 'backflush',
          quantity: -impact.required,
          reference: `Backflush: ${finalBatchNo}`,
          notes: `${quantity} kg ${mixSku}`
        });
      }

      return mix;
    },
    onSuccess: (mix) => {
      queryClient.invalidateQueries({ queryKey: ['mixBatches'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      toast.success(`Blandning registrerad: ${mix.batch_no}`);
      setSelectedMixBatchId(mix.id);
      setActiveTab('tappning');
      const url = new URL(window.location.href);
      url.searchParams.set('mix_batch_id', mix.id);
      window.history.replaceState({}, '', url.toString());
    },
    onError: (error) => {
      toast.error('Kunde inte registrera produktion');
      console.error(error);
    }
  });

  const recentMixes = mixBatches.slice(0, 10);

  const [activeTab, setActiveTab] = useState('tillverkning');
  const [selectedMixBatchId, setSelectedMixBatchId] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preselect = urlParams.get('mix_batch_id');
    if (preselect) {
      setSelectedMixBatchId(preselect);
      setActiveTab('tappning');
    }
  }, []);

  const handleTapClick = (batch) => {
    setSelectedMixBatchId(batch.id);
    setActiveTab('tappning');
    const url = new URL(window.location.href);
    url.searchParams.set('mix_batch_id', batch.id);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Produktion</h1>
          <p className="text-slate-500 mt-1">Tillverkning → färdiga blandningar → tappning</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="tillverkning">Tillverkning</TabsTrigger>
            <TabsTrigger value="mixar">Färdiga blandningar</TabsTrigger>
            <TabsTrigger value="tappning">Tappning</TabsTrigger>
          </TabsList>

          <TabsContent value="tillverkning">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ProductionForm
                  recipeOptions={recipeOptions}
                  componentStock={componentStock}
                  onSubmit={(data) => productionMutation.mutate(data)}
                  isLoading={productionMutation.isPending}
                />
              </div>
              <div className="lg:col-span-1">
                <Card className="p-6 border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Factory className="w-5 h-5 text-indigo-600" />
                    Senaste produktioner
                  </h3>
                  {recentMixes.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Inga produktioner registrerade
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentMixes.map((mix) => (
                        <div key={mix.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              <span className="font-mono text-sm font-medium text-slate-900">{mix.batch_no}</span>
                            </div>
                            <p className="text-sm text-slate-500 truncate">{mix.mix_sku}</p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-slate-900">{mix.produced_kg?.toLocaleString('sv-SE')} kg</p>
                            <p className="text-xs text-slate-500">{mix.produced_at && format(new Date(mix.produced_at), 'd MMM', { locale: sv })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mixar">
            <MixBatchList mixBatches={mixBatches} onTap={handleTapClick} />
          </TabsContent>

          <TabsContent value="tappning">
            <FillingTab selectedMixBatchId={selectedMixBatchId} onCompleted={() => {
              // Refresh lists and keep tab
              setActiveTab('tappning');
              queryClient.invalidateQueries({ queryKey: ['mixBatches'] });
            }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}