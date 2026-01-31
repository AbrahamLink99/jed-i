import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FlaskConical, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SandboxSeeder() {
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const seedMutation = useMutation({
    mutationFn: async () => {
      const results = { products: 0, boms: 0, ledger: 0, batches: 0 };

      // Create sandbox products
      const products = [
        // Raw materials
        { environment: 'sandbox', sku: 'RM-001', name: 'Kakaomassa', type: 'raw_material', unit: 'kg', safety_stock: 100, lead_time_days: 14, moq: 500, supplier: 'Choklad AB', cost_per_unit: 85, active: true },
        { environment: 'sandbox', sku: 'RM-002', name: 'Kakaosmör', type: 'raw_material', unit: 'kg', safety_stock: 50, lead_time_days: 14, moq: 250, supplier: 'Choklad AB', cost_per_unit: 120, active: true },
        { environment: 'sandbox', sku: 'RM-003', name: 'Socker', type: 'raw_material', unit: 'kg', safety_stock: 200, lead_time_days: 7, moq: 1000, supplier: 'Nordic Sugar', cost_per_unit: 12, active: true },
        { environment: 'sandbox', sku: 'RM-004', name: 'Vaniljextrakt', type: 'raw_material', unit: 'liter', safety_stock: 5, lead_time_days: 21, moq: 10, supplier: 'Aroma Import', cost_per_unit: 450, active: true },
        { environment: 'sandbox', sku: 'RM-005', name: 'Mjölkpulver', type: 'raw_material', unit: 'kg', safety_stock: 80, lead_time_days: 10, moq: 500, supplier: 'Arla', cost_per_unit: 65, active: true },
        
        // Packaging
        { environment: 'sandbox', sku: 'PKG-001', name: 'Chokladförpackning 100g', type: 'packaging', unit: 'pcs', safety_stock: 1000, lead_time_days: 14, moq: 5000, supplier: 'PackDesign', cost_per_unit: 2.5, active: true },
        { environment: 'sandbox', sku: 'PKG-002', name: 'Chokladförpackning 200g', type: 'packaging', unit: 'pcs', safety_stock: 500, lead_time_days: 14, moq: 2500, supplier: 'PackDesign', cost_per_unit: 3.5, active: true },
        { environment: 'sandbox', sku: 'PKG-003', name: 'Kartong (12st)', type: 'packaging', unit: 'pcs', safety_stock: 200, lead_time_days: 7, moq: 1000, supplier: 'PackDesign', cost_per_unit: 8, active: true },
        
        // Labels
        { environment: 'sandbox', sku: 'LBL-001', name: 'Etikett Mörk Choklad', type: 'label', unit: 'roll', safety_stock: 10, lead_time_days: 10, moq: 50, supplier: 'LabelPrint', cost_per_unit: 250, active: true },
        { environment: 'sandbox', sku: 'LBL-002', name: 'Etikett Mjölkchoklad', type: 'label', unit: 'roll', safety_stock: 10, lead_time_days: 10, moq: 50, supplier: 'LabelPrint', cost_per_unit: 250, active: true },
        
        // Finished goods
        { environment: 'sandbox', sku: 'FG-001', name: 'Mörk Choklad 70% 100g', type: 'finished_good', brand: 'own', unit: 'pcs', safety_stock: 500, shopify_buffer: 50, active: true },
        { environment: 'sandbox', sku: 'FG-002', name: 'Mjölkchoklad 100g', type: 'finished_good', brand: 'own', unit: 'pcs', safety_stock: 300, shopify_buffer: 30, active: true },
        { environment: 'sandbox', sku: 'FG-003', name: 'Premium Mörk 85% 200g', type: 'finished_good', brand: 'own', unit: 'pcs', safety_stock: 200, shopify_buffer: 20, active: true }
      ];

      for (const product of products) {
        await base44.entities.Product.create(product);
        results.products++;
      }

      // Get created products
      const createdProducts = await base44.entities.Product.filter({ environment: 'sandbox' });
      const productMap = {};
      createdProducts.forEach(p => productMap[p.sku] = p.id);

      // Create BOMs
      const boms = [
        // FG-001: Mörk Choklad 70% (per 1 kg = 10 st à 100g)
        { environment: 'sandbox', finished_product_id: productMap['FG-001'], component_id: productMap['RM-001'], quantity_per_unit: 0.7 },
        { environment: 'sandbox', finished_product_id: productMap['FG-001'], component_id: productMap['RM-002'], quantity_per_unit: 0.25 },
        { environment: 'sandbox', finished_product_id: productMap['FG-001'], component_id: productMap['RM-003'], quantity_per_unit: 0.045 },
        { environment: 'sandbox', finished_product_id: productMap['FG-001'], component_id: productMap['RM-004'], quantity_per_unit: 0.005 },
        
        // FG-002: Mjölkchoklad
        { environment: 'sandbox', finished_product_id: productMap['FG-002'], component_id: productMap['RM-001'], quantity_per_unit: 0.45 },
        { environment: 'sandbox', finished_product_id: productMap['FG-002'], component_id: productMap['RM-002'], quantity_per_unit: 0.25 },
        { environment: 'sandbox', finished_product_id: productMap['FG-002'], component_id: productMap['RM-003'], quantity_per_unit: 0.2 },
        { environment: 'sandbox', finished_product_id: productMap['FG-002'], component_id: productMap['RM-005'], quantity_per_unit: 0.095 },
        { environment: 'sandbox', finished_product_id: productMap['FG-002'], component_id: productMap['RM-004'], quantity_per_unit: 0.005 },
        
        // FG-003: Premium Mörk 85%
        { environment: 'sandbox', finished_product_id: productMap['FG-003'], component_id: productMap['RM-001'], quantity_per_unit: 0.85 },
        { environment: 'sandbox', finished_product_id: productMap['FG-003'], component_id: productMap['RM-002'], quantity_per_unit: 0.12 },
        { environment: 'sandbox', finished_product_id: productMap['FG-003'], component_id: productMap['RM-003'], quantity_per_unit: 0.025 },
        { environment: 'sandbox', finished_product_id: productMap['FG-003'], component_id: productMap['RM-004'], quantity_per_unit: 0.005 }
      ];

      for (const bom of boms) {
        await base44.entities.BOMItem.create(bom);
        results.boms++;
      }

      // Create initial inventory ledger entries
      const ledgerEntries = [
        // Raw materials
        { environment: 'sandbox', product_id: productMap['RM-001'], product_sku: 'RM-001', product_name: 'Kakaomassa', transaction_type: 'inbound', quantity: 250, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['RM-002'], product_sku: 'RM-002', product_name: 'Kakaosmör', transaction_type: 'inbound', quantity: 120, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['RM-003'], product_sku: 'RM-003', product_name: 'Socker', transaction_type: 'inbound', quantity: 500, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['RM-004'], product_sku: 'RM-004', product_name: 'Vaniljextrakt', transaction_type: 'inbound', quantity: 8, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['RM-005'], product_sku: 'RM-005', product_name: 'Mjölkpulver', transaction_type: 'inbound', quantity: 150, reference_type: 'manual', notes: 'Initial sandbox stock' },
        
        // Packaging
        { environment: 'sandbox', product_id: productMap['PKG-001'], product_sku: 'PKG-001', product_name: 'Chokladförpackning 100g', transaction_type: 'inbound', quantity: 2000, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['PKG-002'], product_sku: 'PKG-002', product_name: 'Chokladförpackning 200g', transaction_type: 'inbound', quantity: 800, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['PKG-003'], product_sku: 'PKG-003', product_name: 'Kartong (12st)', transaction_type: 'inbound', quantity: 400, reference_type: 'manual', notes: 'Initial sandbox stock' },
        
        // Labels
        { environment: 'sandbox', product_id: productMap['LBL-001'], product_sku: 'LBL-001', product_name: 'Etikett Mörk Choklad', transaction_type: 'inbound', quantity: 20, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['LBL-002'], product_sku: 'LBL-002', product_name: 'Etikett Mjölkchoklad', transaction_type: 'inbound', quantity: 15, reference_type: 'manual', notes: 'Initial sandbox stock' }
      ];

      for (const entry of ledgerEntries) {
        await base44.entities.InventoryLedger.create(entry);
        results.ledger++;
      }

      // Create sample batches for finished goods
      const batches = [
        {
          environment: 'sandbox',
          batch_number: 'SB-FG001-001',
          product_id: productMap['FG-001'],
          product_sku: 'FG-001',
          product_name: 'Mörk Choklad 70% 100g',
          produced_quantity: 1000,
          current_quantity: 850,
          production_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'available',
          notes: 'Sandbox testbatch'
        },
        {
          environment: 'sandbox',
          batch_number: 'SB-FG002-001',
          product_id: productMap['FG-002'],
          product_sku: 'FG-002',
          product_name: 'Mjölkchoklad 100g',
          produced_quantity: 600,
          current_quantity: 450,
          production_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'available',
          notes: 'Sandbox testbatch'
        }
      ];

      for (const batch of batches) {
        await base44.entities.Batch.create(batch);
        results.batches++;
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries();
      setResult(results);
      toast.success('Sandbox data skapad!');
    },
    onError: (error) => {
      toast.error('Fel vid skapande av sandbox data: ' + error.message);
    }
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const entities = ['Batch', 'InventoryLedger', 'BOMItem', 'Product', 'InventoryAlert', 'PlanningScenario'];
      let deleted = 0;

      for (const entityName of entities) {
        const items = await base44.entities[entityName].filter({ environment: 'sandbox' });
        for (const item of items) {
          await base44.entities[entityName].delete(item.id);
          deleted++;
        }
      }

      return deleted;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries();
      setResult(null);
      toast.success(`${deleted} sandbox-objekt raderade`);
    },
    onError: (error) => {
      toast.error('Fel vid rensning: ' + error.message);
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Sandbox Testdata
          </CardTitle>
          <CardDescription>
            Skapa eller rensa testdata i sandbox-miljön
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Skapar...
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Skapa Sandbox Testdata
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Vill du radera ALL sandbox data? Detta går inte att ångra.')) {
                  clearMutation.mutate();
                }
              }}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rensar...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Rensa Sandbox
                </>
              )}
            </Button>
          </div>

          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription>
                <p className="font-medium text-green-800">Sandbox data skapad!</p>
                <ul className="text-sm mt-2 space-y-1 text-green-700">
                  <li>✓ {result.products} produkter</li>
                  <li>✓ {result.boms} BOM-rader</li>
                  <li>✓ {result.ledger} lagertransaktioner</li>
                  <li>✓ {result.batches} batcher</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Vad inkluderas:</p>
              <ul className="text-sm space-y-1">
                <li>• 5 råvaror (kakaomassa, kakaosmör, socker, vanilj, mjölkpulver)</li>
                <li>• 3 förpackningar och 2 etiketter</li>
                <li>• 3 färdigvaror med kompletta recept (BOM)</li>
                <li>• Initial lagerstock för alla artiklar</li>
                <li>• 2 testbatcher av färdigvaror</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}