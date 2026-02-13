import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Factory, CheckCircle } from 'lucide-react';
import ProductionForm from '@/components/production/ProductionForm';
import { generateBatchNumber, getStockSummary } from '@/components/inventory/StockCalculations';
import { toast } from 'sonner';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';

export default function Production() {
  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();

  const { data: products = [] } = useQuery({
    queryKey: ['products', envFilter.environment],
    queryFn: () => base44.entities.Product.filter(envFilter)
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items', envFilter.environment],
    queryFn: () => base44.entities.BOMItem.filter(envFilter)
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches', envFilter.environment],
    queryFn: () => base44.entities.Batch.filter(envFilter, '-created_date', 20)
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger', envFilter.environment],
    queryFn: () => base44.entities.InventoryLedger.filter(envFilter, '-created_date', 500)
  });

  const finishedProducts = products.filter(p => p.type === 'finished_good' && p.active !== false);

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
      const { productId, product, quantity, productionDate, notes, componentImpact } = data;
      
      // 1. Generate batch number
      const batchNumber = generateBatchNumber(product.sku);
      
      // 2. Create batch
      const batch = await base44.entities.Batch.create({
        environment: envFilter.environment,
        batch_number: batchNumber,
        product_id: productId,
        product_sku: product.sku,
        product_name: product.name,
        produced_quantity: quantity,
        current_quantity: quantity,
        production_date: productionDate,
        status: 'available',
        notes
      });

      // 3. Create ledger entry for production (finished goods in)
      await base44.entities.InventoryLedger.create({
        environment: envFilter.environment,
        product_id: productId,
        product_sku: product.sku,
        product_name: product.name,
        batch_id: batch.id,
        batch_number: batchNumber,
        transaction_type: 'production',
        quantity: quantity,
        reference: `Produktion: ${batchNumber}`,
        notes
      });

      // 4. Create backflush entries for components
      for (const impact of componentImpact) {
        await base44.entities.InventoryLedger.create({
          environment: envFilter.environment,
          product_id: impact.component_id,
          product_sku: impact.component_sku,
          product_name: impact.component_name,
          batch_id: batch.id,
          batch_number: batchNumber,
          transaction_type: 'backflush',
          quantity: -impact.required, // Negative = consumption
          reference: `Backflush för: ${batchNumber}`,
          notes: `${quantity} ${product.unit} ${product.sku}`
        });
      }

      return batch;
    },
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      toast.success(`Produktion registrerad: ${batch.batch_number}`);
    },
    onError: (error) => {
      toast.error('Kunde inte registrera produktion');
      console.error(error);
    }
  });

  const recentBatches = batches.slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Produktion</h1>
          <p className="text-slate-500 mt-1">Registrera vad som har producerats</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Production Form */}
          <div className="lg:col-span-2">
            <ProductionForm
              finishedProducts={finishedProducts}
              bomItems={bomWithNames}
              componentStock={componentStock}
              onSubmit={(data) => productionMutation.mutate(data)}
              isLoading={productionMutation.isPending}
            />
          </div>

          {/* Recent Productions */}
          <div className="lg:col-span-1">
            <Card className="p-6 border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Factory className="w-5 h-5 text-indigo-600" />
                Senaste produktioner
              </h3>
              
              {recentBatches.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Inga produktioner registrerade</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentBatches.map((batch) => (
                    <div 
                      key={batch.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="font-mono text-sm font-medium text-slate-900">
                            {batch.batch_number}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {batch.product_name || batch.product_sku}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-slate-900">
                          {batch.produced_quantity?.toLocaleString('sv-SE')} kg
                        </p>
                        <p className="text-xs text-slate-500">
                          {batch.production_date && format(new Date(batch.production_date), 'd MMM', { locale: sv })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}