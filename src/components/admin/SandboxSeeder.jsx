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
      const results = { products: 0, boms: 0, ledger: 0, batches: 0, mixBatches: 0, packagingRecipes: 0 };

      // Create sandbox products
      const products = [
        // Raw materials - Schampo-råvaror
        { environment: 'sandbox', sku: 'TEST-RM-001', name: 'Natriumlaurylsulfat (SLS)', type: 'raw_material', unit: 'kg', safety_stock: 50, lead_time_days: 14, moq: 200, supplier: 'Kemi AB', cost_per_unit: 45, active: true },
        { environment: 'sandbox', sku: 'TEST-RM-002', name: 'Kokamidopropylbetain', type: 'raw_material', unit: 'kg', safety_stock: 30, lead_time_days: 14, moq: 100, supplier: 'Kemi AB', cost_per_unit: 85, active: true },
        { environment: 'sandbox', sku: 'TEST-RM-003', name: 'Glycerin', type: 'raw_material', unit: 'kg', safety_stock: 40, lead_time_days: 10, moq: 150, supplier: 'Kemi AB', cost_per_unit: 35, active: true },
        { environment: 'sandbox', sku: 'TEST-RM-004', name: 'Panthenol (ProVitamin B5)', type: 'raw_material', unit: 'kg', safety_stock: 10, lead_time_days: 21, moq: 25, supplier: 'Vitaminer Import', cost_per_unit: 320, active: true },
        { environment: 'sandbox', sku: 'TEST-RM-005', name: 'Citric Acid', type: 'raw_material', unit: 'kg', safety_stock: 20, lead_time_days: 7, moq: 50, supplier: 'Kemi AB', cost_per_unit: 28, active: true },
        { environment: 'sandbox', sku: 'TEST-RM-006', name: 'Parfym - Lavendel', type: 'raw_material', unit: 'liter', safety_stock: 5, lead_time_days: 14, moq: 10, supplier: 'Doft AB', cost_per_unit: 280, active: true },
        { environment: 'sandbox', sku: 'TEST-RM-007', name: 'Konserveringsmedel', type: 'raw_material', unit: 'kg', safety_stock: 15, lead_time_days: 14, moq: 50, supplier: 'Kemi AB', cost_per_unit: 95, active: true },
        
        // Packaging - Schampoflaskor
        { environment: 'sandbox', sku: 'TEST-PKG-001', name: 'Schampoflaska 250ml', type: 'packaging', unit: 'pcs', safety_stock: 500, lead_time_days: 21, moq: 2000, supplier: 'Plastic Packaging', cost_per_unit: 3.2, active: true },
        { environment: 'sandbox', sku: 'TEST-PKG-002', name: 'Schampoflaska 500ml', type: 'packaging', unit: 'pcs', safety_stock: 300, lead_time_days: 21, moq: 1000, supplier: 'Plastic Packaging', cost_per_unit: 4.5, active: true },
        { environment: 'sandbox', sku: 'TEST-PKG-003', name: 'Pumplock 250ml', type: 'packaging', unit: 'pcs', safety_stock: 500, lead_time_days: 14, moq: 2000, supplier: 'Plastic Packaging', cost_per_unit: 1.8, active: true },
        { environment: 'sandbox', sku: 'TEST-PKG-004', name: 'Pumplock 500ml', type: 'packaging', unit: 'pcs', safety_stock: 300, lead_time_days: 14, moq: 1000, supplier: 'Plastic Packaging', cost_per_unit: 2.2, active: true },
        
        // Labels
        { environment: 'sandbox', sku: 'TEST-LBL-001', name: 'Etikett Volym Schampo', type: 'label', unit: 'roll', safety_stock: 10, lead_time_days: 10, moq: 50, supplier: 'Etikett Print', cost_per_unit: 180, active: true },
        { environment: 'sandbox', sku: 'TEST-LBL-002', name: 'Etikett Mild Schampo', type: 'label', unit: 'roll', safety_stock: 10, lead_time_days: 10, moq: 50, supplier: 'Etikett Print', cost_per_unit: 180, active: true },
        
        // Finished goods - Färdiga schampon
        { environment: 'sandbox', sku: 'TEST-FG-001', name: 'Volym Schampo 250ml', type: 'finished_good', brand: 'own', unit: 'pcs', safety_stock: 200, shopify_buffer: 20, active: true },
        { environment: 'sandbox', sku: 'TEST-FG-002', name: 'Volym Schampo 500ml', type: 'finished_good', brand: 'own', unit: 'pcs', safety_stock: 150, shopify_buffer: 15, active: true },
        { environment: 'sandbox', sku: 'TEST-FG-003', name: 'Mild Schampo 250ml', type: 'finished_good', brand: 'own', unit: 'pcs', safety_stock: 180, shopify_buffer: 18, active: true },
        
        // Mix products (för tappning) - Schampoblandningar
        { environment: 'sandbox', sku: 'TEST-MIX-VOLYM', name: 'Schampoblandning Volym', type: 'raw_material', unit: 'kg', active: true },
        { environment: 'sandbox', sku: 'TEST-MIX-MILD', name: 'Schampoblandning Mild', type: 'raw_material', unit: 'kg', active: true }
      ];

      for (const product of products) {
        await base44.entities.Product.create(product);
        results.products++;
      }

      // Get created products
      const createdProducts = await base44.entities.Product.filter({ environment: 'sandbox' });
      const productMap = {};
      createdProducts.forEach(p => productMap[p.sku] = p.id);

      // Create BOMs - Schamporecept (per 1 kg = ca 1 liter schampo)
      const boms = [
        // TEST-FG-001: Volym Schampo (per 1 kg bulk)
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-001'], component_id: productMap['TEST-RM-001'], quantity_per_unit: 0.35 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-001'], component_id: productMap['TEST-RM-002'], quantity_per_unit: 0.15 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-001'], component_id: productMap['TEST-RM-003'], quantity_per_unit: 0.08 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-001'], component_id: productMap['TEST-RM-004'], quantity_per_unit: 0.02 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-001'], component_id: productMap['TEST-RM-005'], quantity_per_unit: 0.01 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-001'], component_id: productMap['TEST-RM-006'], quantity_per_unit: 0.015 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-001'], component_id: productMap['TEST-RM-007'], quantity_per_unit: 0.005 },
        
        // TEST-FG-002: Volym Schampo 500ml (samma recept, annan storlek)
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-002'], component_id: productMap['TEST-RM-001'], quantity_per_unit: 0.35 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-002'], component_id: productMap['TEST-RM-002'], quantity_per_unit: 0.15 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-002'], component_id: productMap['TEST-RM-003'], quantity_per_unit: 0.08 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-002'], component_id: productMap['TEST-RM-004'], quantity_per_unit: 0.02 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-002'], component_id: productMap['TEST-RM-005'], quantity_per_unit: 0.01 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-002'], component_id: productMap['TEST-RM-006'], quantity_per_unit: 0.015 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-002'], component_id: productMap['TEST-RM-007'], quantity_per_unit: 0.005 },
        
        // TEST-FG-003: Mild Schampo (mildare formula)
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-003'], component_id: productMap['TEST-RM-001'], quantity_per_unit: 0.25 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-003'], component_id: productMap['TEST-RM-002'], quantity_per_unit: 0.20 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-003'], component_id: productMap['TEST-RM-003'], quantity_per_unit: 0.12 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-003'], component_id: productMap['TEST-RM-004'], quantity_per_unit: 0.03 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-003'], component_id: productMap['TEST-RM-005'], quantity_per_unit: 0.015 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-003'], component_id: productMap['TEST-RM-006'], quantity_per_unit: 0.01 },
        { environment: 'sandbox', finished_product_id: productMap['TEST-FG-003'], component_id: productMap['TEST-RM-007'], quantity_per_unit: 0.005 }
      ];

      for (const bom of boms) {
        await base44.entities.BOMItem.create(bom);
        results.boms++;
      }

      // Create initial inventory ledger entries
      const ledgerEntries = [
        // Raw materials
        { environment: 'sandbox', product_id: productMap['TEST-RM-001'], product_sku: 'TEST-RM-001', product_name: 'Natriumlaurylsulfat (SLS)', transaction_type: 'inbound', quantity: 150, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-RM-002'], product_sku: 'TEST-RM-002', product_name: 'Kokamidopropylbetain', transaction_type: 'inbound', quantity: 80, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-RM-003'], product_sku: 'TEST-RM-003', product_name: 'Glycerin', transaction_type: 'inbound', quantity: 120, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-RM-004'], product_sku: 'TEST-RM-004', product_name: 'Panthenol (ProVitamin B5)', transaction_type: 'inbound', quantity: 25, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-RM-005'], product_sku: 'TEST-RM-005', product_name: 'Citric Acid', transaction_type: 'inbound', quantity: 50, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-RM-006'], product_sku: 'TEST-RM-006', product_name: 'Parfym - Lavendel', transaction_type: 'inbound', quantity: 12, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-RM-007'], product_sku: 'TEST-RM-007', product_name: 'Konserveringsmedel', transaction_type: 'inbound', quantity: 35, reference_type: 'manual', notes: 'Initial sandbox stock' },
        
        // Packaging
        { environment: 'sandbox', product_id: productMap['TEST-PKG-001'], product_sku: 'TEST-PKG-001', product_name: 'Schampoflaska 250ml', transaction_type: 'inbound', quantity: 1500, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-PKG-002'], product_sku: 'TEST-PKG-002', product_name: 'Schampoflaska 500ml', transaction_type: 'inbound', quantity: 800, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-PKG-003'], product_sku: 'TEST-PKG-003', product_name: 'Pumplock 250ml', transaction_type: 'inbound', quantity: 1500, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-PKG-004'], product_sku: 'TEST-PKG-004', product_name: 'Pumplock 500ml', transaction_type: 'inbound', quantity: 800, reference_type: 'manual', notes: 'Initial sandbox stock' },
        
        // Labels
        { environment: 'sandbox', product_id: productMap['TEST-LBL-001'], product_sku: 'TEST-LBL-001', product_name: 'Etikett Volym Schampo', transaction_type: 'inbound', quantity: 15, reference_type: 'manual', notes: 'Initial sandbox stock' },
        { environment: 'sandbox', product_id: productMap['TEST-LBL-002'], product_sku: 'TEST-LBL-002', product_name: 'Etikett Mild Schampo', transaction_type: 'inbound', quantity: 12, reference_type: 'manual', notes: 'Initial sandbox stock' }
      ];

      for (const entry of ledgerEntries) {
        await base44.entities.InventoryLedger.create(entry);
        results.ledger++;
      }

      // Create sample batches for finished goods
      const batches = [
        {
          environment: 'sandbox',
          batch_number: 'TEST-BATCH-001',
          product_id: productMap['TEST-FG-001'],
          product_sku: 'TEST-FG-001',
          product_name: 'Volym Schampo 250ml',
          produced_quantity: 500,
          current_quantity: 420,
          production_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'available',
          notes: 'Sandbox testbatch'
        },
        {
          environment: 'sandbox',
          batch_number: 'TEST-BATCH-002',
          product_id: productMap['TEST-FG-003'],
          product_sku: 'TEST-FG-003',
          product_name: 'Mild Schampo 250ml',
          produced_quantity: 400,
          current_quantity: 330,
          production_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'available',
          notes: 'Sandbox testbatch'
        }
      ];

      for (const batch of batches) {
        await base44.entities.Batch.create(batch);
        results.batches++;
      }

      // Create MixBatches för tappning
      const mixBatches = [
        {
          environment: 'sandbox',
          mix_sku: 'TEST-MIX-VOLYM',
          batch_no: 'TEST-MIX-VOLYM-2026-001',
          produced_kg: 300,
          remaining_kg: 220,
          status: 'available',
          produced_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Testbatch för tappning - Volym schampo'
        },
        {
          environment: 'sandbox',
          mix_sku: 'TEST-MIX-MILD',
          batch_no: 'TEST-MIX-MILD-2026-001',
          produced_kg: 250,
          remaining_kg: 180,
          status: 'available',
          produced_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Testbatch för tappning - Mild schampo'
        }
      ];

      for (const mixBatch of mixBatches) {
        await base44.entities.MixBatch.create(mixBatch);
        results.mixBatches++;
      }

      // Create PackagingRecipes
      const packagingRecipes = [
        {
          environment: 'sandbox',
          mix_sku: 'TEST-MIX-VOLYM',
          finished_sku: 'TEST-FG-001',
          finished_name: 'Volym Schampo 250ml',
          fill_ml_per_unit: 250,
          components: [
            { component_sku: 'TEST-PKG-001', component_name: 'Schampoflaska 250ml', qty_per_unit: 1 },
            { component_sku: 'TEST-PKG-003', component_name: 'Pumplock 250ml', qty_per_unit: 1 },
            { component_sku: 'TEST-LBL-001', component_name: 'Etikett Volym Schampo', qty_per_unit: 1 }
          ],
          active: true
        },
        {
          environment: 'sandbox',
          mix_sku: 'TEST-MIX-VOLYM',
          finished_sku: 'TEST-FG-002',
          finished_name: 'Volym Schampo 500ml',
          fill_ml_per_unit: 500,
          components: [
            { component_sku: 'TEST-PKG-002', component_name: 'Schampoflaska 500ml', qty_per_unit: 1 },
            { component_sku: 'TEST-PKG-004', component_name: 'Pumplock 500ml', qty_per_unit: 1 },
            { component_sku: 'TEST-LBL-001', component_name: 'Etikett Volym Schampo', qty_per_unit: 1 }
          ],
          active: true
        },
        {
          environment: 'sandbox',
          mix_sku: 'TEST-MIX-MILD',
          finished_sku: 'TEST-FG-003',
          finished_name: 'Mild Schampo 250ml',
          fill_ml_per_unit: 250,
          components: [
            { component_sku: 'TEST-PKG-001', component_name: 'Schampoflaska 250ml', qty_per_unit: 1 },
            { component_sku: 'TEST-PKG-003', component_name: 'Pumplock 250ml', qty_per_unit: 1 },
            { component_sku: 'TEST-LBL-002', component_name: 'Etikett Mild Schampo', qty_per_unit: 1 }
          ],
          active: true
        }
      ];

      for (const recipe of packagingRecipes) {
        await base44.entities.PackagingRecipe.create(recipe);
        results.packagingRecipes++;
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
      const entities = ['FillingReport', 'PackagingRecipe', 'MixBatch', 'Batch', 'InventoryLedger', 'BOMItem', 'Product', 'InventoryAlert', 'PlanningScenario'];
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
                  <li>✓ {result.mixBatches} blandningsbatcher</li>
                  <li>✓ {result.packagingRecipes} tappningsrecept</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Vad inkluderas:</p>
              <ul className="text-sm space-y-1">
                <li>• 7 råvaror för schampo (tensider, glycerin, panthenol, parfym, etc)</li>
                <li>• 4 förpackningar (flaskor och lock) och 2 etiketter</li>
                <li>• 3 färdiga schampoprodukter med kompletta recept (BOM)</li>
                <li>• Initial lagerstock för alla artiklar</li>
                <li>• 2 testbatcher av färdigvaror</li>
                <li>• 2 schampoblandningsbatcher redo för tappning</li>
                <li>• 3 tappningsrecept med alla förpackningskomponenter</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}