import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Trash2, Database, Download } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeName, matchIngredient } from '../metics/NameNormalizer';
import { auditLog } from '../auth/AuditLogger';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Auto-detect delimiter (comma or semicolon)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    
    const headers = firstLine.split(delimiter).map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      data.push(row);
    }
    
    return data;
  };

  // Import raw materials
  const importRawMaterials = async (data) => {
    const results = { success: 0, failed: 0, skipped: 0, errors: [] };
    const existingProducts = await base44.entities.Product.list();
    const existingSKUs = new Set(existingProducts.map(p => p.sku));
    
    for (const row of data) {
      try {
        const product = {
          sku: row.SKU || row.Artikelnr || row.sku,
          name: row.Namn || row.Name || row.name || row.Handelsnamn,
          type: 'raw_material',
          unit: row.Enhet || row.Unit || 'kg',
          supplier: row.Leverantör || row.Supplier || '',
          cost_per_unit: parseFloat(row.Kostnad || row.Cost || 0),
          notes: row.Anteckningar || row.Notes || '',
          active: true
        };

        if (!product.sku || !product.name) {
          results.errors.push(`Rad saknar SKU eller namn: ${JSON.stringify(row)}`);
          results.failed++;
          continue;
        }

        if (existingSKUs.has(product.sku)) {
          // Uppdatera lager om Saldo angivits i filen
          const saldoStr = row.Saldo;
          if (saldoStr !== undefined && String(saldoStr).trim() !== '') {
            const productRef = existingProducts.find(p => p.sku === product.sku);
            const target = parseFloat(String(saldoStr).replace(',', '.'));
            if (!isNaN(target) && productRef) {
              const ledgers = await base44.entities.InventoryLedger.filter({ product_id: productRef.id, environment: envFilter.environment }, '-created_date', 1000);
              const onHand = (ledgers || []).reduce((sum, l) => (l.transaction_type === 'reservation' || l.transaction_type === 'release_reservation') ? sum : sum + (l.quantity || 0), 0);
              const delta = Number((target - onHand).toFixed(6));
              if (Math.abs(delta) >= 1e-9) {
                await base44.entities.InventoryLedger.create({
                  environment: envFilter.environment,
                  product_id: productRef.id,
                  product_sku: productRef.sku,
                  product_name: productRef.name,
                  transaction_type: 'adjustment',
                  quantity: delta,
                  reference_type: 'manual',
                  notes: `Lagerimport (${new Date().toISOString().slice(0,10)})`
                });
                await auditLog.createEntity('InventoryLedger', productRef.sku, { delta, target }, 'DataImport');
              }
              results.success++;
            } else {
              results.skipped++;
            }
          } else {
            results.skipped++;
          }
          continue;
        }

        const created = await base44.entities.Product.create(product);
        await auditLog.createEntity('Product', product.sku, product, 'DataImport');
        // Sätt lagersaldo om angivet i mallen
        if (row.Saldo !== undefined && String(row.Saldo).trim() !== '') {
          const target = parseFloat(String(row.Saldo).replace(',', '.'));
          if (!isNaN(target)) {
            const ledgers = await base44.entities.InventoryLedger.filter({ product_id: created.id, environment: envFilter.environment }, '-created_date', 1000);
            const onHand = (ledgers || []).reduce((sum, l) => (l.transaction_type === 'reservation' || l.transaction_type === 'release_reservation') ? sum : sum + (l.quantity || 0), 0);
            const delta = Number((target - onHand).toFixed(6));
            if (Math.abs(delta) >= 1e-9) {
              await base44.entities.InventoryLedger.create({
                environment: envFilter.environment,
                product_id: created.id,
                product_sku: product.sku,
                product_name: product.name,
                transaction_type: 'adjustment',
                quantity: delta,
                reference_type: 'manual',
                notes: `Lagerimport (${new Date().toISOString().slice(0,10)})`
              });
              await auditLog.createEntity('InventoryLedger', product.sku, { delta, target }, 'DataImport');
            }
          }
        }
        results.success++;
      } catch (error) {
        results.errors.push(`${row.SKU}: ${error.message}`);
        results.failed++;
      }
      setProgress((results.success + results.failed + results.skipped) / data.length * 100);
    }
    
    return results;
  };

  // Import bottles/packaging
  const importPackaging = async (data) => {
    const results = { success: 0, failed: 0, skipped: 0, errors: [] };
    const existingProducts = await base44.entities.Product.list();
    const existingSKUs = new Set(existingProducts.map(p => p.sku));
    
    for (const row of data) {
      try {
        const product = {
          sku: row.SKU || row.Artikelnr || row.sku,
          name: row.Namn || row.Name || row.name,
          type: 'packaging',
          unit: 'pcs',
          supplier: row.Leverantör || row.Supplier || '',
          cost_per_unit: parseFloat(row.Kostnad || row.Cost || 0),
          notes: row.Anteckningar || row.Notes || '',
          active: true
        };
...
        const created = await base44.entities.Product.create(product);
        await auditLog.createEntity('Product', product.sku, product, 'DataImport');
        if (row.Saldo !== undefined && String(row.Saldo).trim() !== '') {
          const target = parseFloat(String(row.Saldo).replace(',', '.'));
          if (!isNaN(target)) {
            const ledgers = await base44.entities.InventoryLedger.filter({ product_id: created.id, environment: envFilter.environment }, '-created_date', 1000);
            const onHand = (ledgers || []).reduce((sum, l) => (l.transaction_type === 'reservation' || l.transaction_type === 'release_reservation') ? sum : sum + (l.quantity || 0), 0);
            const delta = Number((target - onHand).toFixed(6));
            if (Math.abs(delta) >= 1e-9) {
              await base44.entities.InventoryLedger.create({
                environment: envFilter.environment,
                product_id: created.id,
                product_sku: product.sku,
                product_name: product.name,
                transaction_type: 'adjustment',
                quantity: delta,
                reference_type: 'manual',
                notes: `Lagerimport (${new Date().toISOString().slice(0,10)})`
              });
              await auditLog.createEntity('InventoryLedger', product.sku, { delta, target }, 'DataImport');
            }
          }
        }
        results.success++;
      } catch (error) {
        results.errors.push(`${row.SKU}: ${error.message}`);
        results.failed++;
      }
      setProgress((results.success + results.failed + results.skipped) / data.length * 100);
    }
    
    return results;
  };

  // Import labels
  const importLabels = async (data) => {
    const results = { success: 0, failed: 0, skipped: 0, errors: [] };
    const existingProducts = await base44.entities.Product.list();
    const existingSKUs = new Set(existingProducts.map(p => p.sku));
    
    for (const row of data) {
      try {
        const product = {
          sku: row.SKU || row.Artikelnr || row.sku,
          name: row.Namn || row.Name || row.name,
          type: 'label',
          unit: 'pcs',
          supplier: row.Leverantör || row.Supplier || '',
          cost_per_unit: parseFloat(row.Kostnad || row.Cost || 0),
          notes: row.Anteckningar || row.Notes || '',
          active: true
        };
...
        const created = await base44.entities.Product.create(product);
        await auditLog.createEntity('Product', product.sku, product, 'DataImport');
        if (row.Saldo !== undefined && String(row.Saldo).trim() !== '') {
          const target = parseFloat(String(row.Saldo).replace(',', '.'));
          if (!isNaN(target)) {
            const ledgers = await base44.entities.InventoryLedger.filter({ product_id: created.id, environment: envFilter.environment }, '-created_date', 1000);
            const onHand = (ledgers || []).reduce((sum, l) => (l.transaction_type === 'reservation' || l.transaction_type === 'release_reservation') ? sum : sum + (l.quantity || 0), 0);
            const delta = Number((target - onHand).toFixed(6));
            if (Math.abs(delta) >= 1e-9) {
              await base44.entities.InventoryLedger.create({
                environment: envFilter.environment,
                product_id: created.id,
                product_sku: product.sku,
                product_name: product.name,
                transaction_type: 'adjustment',
                quantity: delta,
                reference_type: 'manual',
                notes: `Lagerimport (${new Date().toISOString().slice(0,10)})`
              });
              await auditLog.createEntity('InventoryLedger', product.sku, { delta, target }, 'DataImport');
            }
          }
        }
        results.success++;
      } catch (error) {
        results.errors.push(`${row.SKU}: ${error.message}`);
        results.failed++;
      }
      setProgress((results.success + results.failed + results.skipped) / data.length * 100);
    }
    
    return results;
  };

  // Import inventory levels (overwrite to match file)
  const importInventoryLevels = async (data) => {
    const results = { success: 0, failed: 0, skipped: 0, errors: [] };
    const products = await base44.entities.Product.list();
    const productBySku = new Map(products.map(p => [p.sku, p]));

    for (const row of data) {
      try {
        const sku = row.SKU || row.Artikelnr || row.sku;
        const targetStr = row.Saldo || row.Quantity || row.Kvantitet || row.OnHand;
        const target = parseFloat(String(targetStr).replace(',', '.'));
        if (!sku || isNaN(target)) {
          results.failed++;
          results.errors.push(`Rad saknar giltigt SKU/saldo: ${JSON.stringify(row)}`);
          continue;
        }
        const product = productBySku.get(sku);
        if (!product) {
          results.failed++;
          results.errors.push(`Produkt med SKU ${sku} hittades inte`);
          continue;
        }
        // Fetch ledger for this product (current environment)
        const ledgers = await base44.entities.InventoryLedger.filter({ product_id: product.id, environment: envFilter.environment }, '-created_date', 1000);
        const onHand = (ledgers || []).reduce((sum, l) => {
          return (l.transaction_type === 'reservation' || l.transaction_type === 'release_reservation') ? sum : sum + (l.quantity || 0);
        }, 0);
        const delta = Number((target - onHand).toFixed(6));
        if (Math.abs(delta) < 1e-9) {
          results.skipped++;
          continue;
        }
        await base44.entities.InventoryLedger.create({
          environment: envFilter.environment,
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          transaction_type: 'adjustment',
          quantity: delta,
          reference_type: 'manual',
          notes: `Lagerimport (${new Date().toISOString().slice(0,10)})`
        });
        await auditLog.createEntity('InventoryLedger', product.sku, { delta, target }, 'DataImport');
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(error.message);
      }
      setProgress((results.success + results.failed + results.skipped) / data.length * 100);
    }

    return results;
  };

  // Import finished products
  const importFinishedProducts = async (data) => {
    const results = { success: 0, failed: 0, skipped: 0, errors: [] };
    const existingProducts = await base44.entities.Product.list();
    const existingSKUs = new Set(existingProducts.map(p => p.sku));
    
    for (const row of data) {
      try {
        const product = {
          sku: row.SKU || row.Artikelnr || row.sku,
          name: row.Namn || row.Name || row.name,
          type: 'finished_good',
          unit: 'kg',
          notes: row.Anteckningar || row.Notes || '',
          active: true
        };
...
        const created = await base44.entities.Product.create(product);
        await auditLog.createEntity('Product', product.sku, product, 'DataImport');
        if (row.Saldo !== undefined && String(row.Saldo).trim() !== '') {
          const target = parseFloat(String(row.Saldo).replace(',', '.'));
          if (!isNaN(target)) {
            const ledgers = await base44.entities.InventoryLedger.filter({ product_id: created.id, environment: envFilter.environment }, '-created_date', 1000);
            const onHand = (ledgers || []).reduce((sum, l) => (l.transaction_type === 'reservation' || l.transaction_type === 'release_reservation') ? sum : sum + (l.quantity || 0), 0);
            const delta = Number((target - onHand).toFixed(6));
            if (Math.abs(delta) >= 1e-9) {
              await base44.entities.InventoryLedger.create({
                environment: envFilter.environment,
                product_id: created.id,
                product_sku: product.sku,
                product_name: product.name,
                transaction_type: 'adjustment',
                quantity: delta,
                reference_type: 'manual',
                notes: `Lagerimport (${new Date().toISOString().slice(0,10)})`
              });
              await auditLog.createEntity('InventoryLedger', product.sku, { delta, target }, 'DataImport');
            }
          }
        }
        results.success++;
      } catch (error) {
        results.errors.push(`${row.SKU}: ${error.message}`);
        results.failed++;
      }
      setProgress((results.success + results.failed + results.skipped) / data.length * 100);
    }
    
    return results;
  };

  // Import recipes/BOM
  const importRecipes = async (data) => {
    const results = { success: 0, failed: 0, errors: [] };
    const products = await base44.entities.Product.list();
    
    // Group by finished product
    const recipesByProduct = {};
    for (const row of data) {
      const finishedSku = row.FärdigvaraSKU || row.FinishedSKU || row.Artikelnr;
      if (!finishedSku) continue;
      
      if (!recipesByProduct[finishedSku]) {
        recipesByProduct[finishedSku] = {
          finishedSku,
          finishedName: row.FärdigvaraNamn || row.FinishedName || row.Namn,
          components: []
        };
      }
      
      if (row.IngrediensSKU || row.ComponentSKU || row.Handelsnamn) {
        recipesByProduct[finishedSku].components.push({
          componentSku: row.IngrediensSKU || row.ComponentSKU,
          componentName: row.IngrediensNamn || row.ComponentName || row.Handelsnamn,
          quantity: parseFloat(row.Mängd || row.Quantity || row['Mängd kg'] || 0)
        });
      }
    }

    for (const [sku, recipe] of Object.entries(recipesByProduct)) {
      try {
        // Find finished product
        const finishedProduct = products.find(p => p.sku === recipe.finishedSku);
        if (!finishedProduct) {
          results.errors.push(`Färdigvara ${recipe.finishedSku} hittades inte`);
          results.failed++;
          continue;
        }

        // Match components
        for (const comp of recipe.components) {
          let component = products.find(p => p.sku === comp.componentSku);
          
          if (!component && comp.componentName) {
            const match = matchIngredient(comp.componentName, products, [], []);
            if (match.matched) {
              component = match.product;
            }
          }

          if (!component) {
            results.errors.push(`Komponent "${comp.componentName}" för ${recipe.finishedSku} hittades inte`);
            continue;
          }

          // Create BOM item
          await base44.entities.BOMItem.create({
            finished_product_id: finishedProduct.id,
            component_id: component.id,
            quantity_per_unit: comp.quantity
          });
        }

        results.success++;
        await auditLog.createEntity('BOM', finishedProduct.id, recipe, 'DataImport');
      } catch (error) {
        results.errors.push(`${sku}: ${error.message}`);
        results.failed++;
      }
      setProgress((results.success + results.failed) / Object.keys(recipesByProduct).length * 100);
    }
    
    return results;
  };

  const handleImport = async (importType) => {
    if (!file) {
      toast.error('Välj en fil först');
      return;
    }

    setImporting(true);
    setProgress(0);
    setImportResults(null);

    try {
      const text = await file.text();
      const data = parseCSV(text);

      let results;
      switch (importType) {
        case 'raw_materials':
          results = await importRawMaterials(data);
          break;
        case 'packaging':
          results = await importPackaging(data);
          break;
        case 'labels':
          results = await importLabels(data);
          break;
        case 'finished_products':
          results = await importFinishedProducts(data);
          break;
        case 'recipes':
          results = await importRecipes(data);
          break;

        default:
          throw new Error('Okänd importtyp');
      }

      setImportResults(results);
      queryClient.invalidateQueries();
      
      if (results.success > 0) {
        toast.success(`${results.success} poster importerade`);
      }
      if (results.failed > 0) {
        toast.error(`${results.failed} poster misslyckades`);
      }
    } catch (error) {
      toast.error('Import misslyckades: ' + error.message);
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  const downloadTemplate = (type) => {
    let headers = '';
    let exampleRow = '';
    let filename = '';

    switch (type) {
      case 'raw_materials':
        headers = 'SKU,Namn,Enhet,Leverantör,Kostnad,Anteckningar,Saldo';
        exampleRow = 'RAW001,Olivolja Extra Virgin,kg,Supplier AB,150.50,Ekologisk,125.5';
        filename = 'mall_ravaror.csv';
        break;
      case 'packaging':
        headers = 'SKU,Namn,Leverantör,Kostnad,Anteckningar,Saldo';
        exampleRow = 'PKG001,Glasflaska 500ml,Packaging AB,12.50,Standard flaska,100';
        filename = 'mall_forpackningar.csv';
        break;
      case 'labels':
        headers = 'SKU,Namn,Leverantör,Kostnad,Anteckningar,Saldo';
        exampleRow = 'LBL001,Etikett Premium,Label AB,2.50,Vattentålig,100';
        filename = 'mall_etiketter.csv';
        break;
      case 'finished_products':
        headers = 'SKU,Namn,Anteckningar,Saldo';
        exampleRow = 'FG001,Premium Olivolja 500ml,Färdig produkt,250';
        filename = 'mall_fardigvaror.csv';
        break;
      case 'recipes':
        headers = 'FärdigvaraSKU,FärdigvaraNamn,IngrediensSKU,IngrediensNamn,Mängd';
        exampleRow = 'FG001,Premium Olivolja,RAW001,Olivolja,0.480';
        filename = 'mall_recept.csv';
        break;

    }

    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Mall nedladdad: ${filename}`);
  };

  const clearAllData = async () => {
    if (!confirm('Är du säker på att du vill radera ALL data? Detta går inte att ångra!')) {
      return;
    }

    try {
      // Delete all entities in order
      const entities = ['BOMItem', 'Batch', 'InventoryLedger', 'ShopifyOrder', 'ShopifyMapping', 
                       'InventoryAlert', 'PlanningScenario', 'Product', 'IngredientMappingRule', 'IngredientAlias'];
      
      for (const entity of entities) {
        try {
          const items = await base44.entities[entity].list();
          for (const item of items) {
            await base44.entities[entity].delete(item.id);
          }
        } catch (error) {
          console.error(`Failed to clear ${entity}:`, error);
        }
      }

      queryClient.invalidateQueries();
      toast.success('Alla data raderade');
      await auditLog.logAudit({
        actionType: 'DELETE',
        entityType: 'System',
        summaryMessage: 'Raderade all systemdata',
        pageContext: 'DataImport'
      });
    } catch (error) {
      toast.error('Kunde inte radera data: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clear Data Section */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            Rensa systemdata
          </CardTitle>
          <CardDescription>
            Radera all data från systemet (produkter, lager, recept, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={clearAllData}>
            <Trash2 className="w-4 h-4 mr-2" />
            Radera all data
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Importera data
          </CardTitle>
          <CardDescription>
            Ladda upp CSV-filer för att importera råvaror, förpackningar, etiketter, färdiga produkter och recept
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Välj CSV-fil</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          <Tabs defaultValue="raw_materials" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="raw_materials">Råvaror</TabsTrigger>
              <TabsTrigger value="packaging">Flaskor</TabsTrigger>
              <TabsTrigger value="labels">Etiketter</TabsTrigger>
              <TabsTrigger value="finished_products">Färdiga</TabsTrigger>


            </TabsList>

            <TabsContent value="raw_materials" className="space-y-3">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <strong>Format:</strong> SKU, Namn, Enhet, Leverantör, Kostnad, Anteckningar, Saldo (valfritt)
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={() => downloadTemplate('raw_materials')} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Ladda ner mall
                </Button>
                <Button onClick={() => handleImport('raw_materials')} disabled={!file || importing}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importera råvaror
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="packaging" className="space-y-3">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <strong>Format:</strong> SKU, Namn, Leverantör, Kostnad, Anteckningar, Saldo
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={() => downloadTemplate('packaging')} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Ladda ner mall
                </Button>
                <Button onClick={() => handleImport('packaging')} disabled={!file || importing}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importera flaskor/förpackningar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="labels" className="space-y-3">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <strong>Format:</strong> SKU, Namn, Leverantör, Kostnad, Anteckningar, Saldo
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={() => downloadTemplate('labels')} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Ladda ner mall
                </Button>
                <Button onClick={() => handleImport('labels')} disabled={!file || importing}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importera etiketter
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="finished_products" className="space-y-3">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <strong>Format:</strong> SKU, Namn, Anteckningar, Saldo
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={() => downloadTemplate('finished_products')} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Ladda ner mall
                </Button>
                <Button onClick={() => handleImport('finished_products')} disabled={!file || importing}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importera färdiga produkter
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="recipes" className="space-y-3">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <strong>Format:</strong> FärdigvaraSKU, FärdigvaraNamn, IngrediensSKU/Handelsnamn, Mängd
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={() => downloadTemplate('recipes')} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Ladda ner mall
                </Button>
                <Button onClick={() => handleImport('recipes')} disabled={!file || importing}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importera recept (BOM)
                </Button>
              </div>
            </TabsContent>


          </Tabs>

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-slate-500 text-center">{Math.round(progress)}% klart</p>
            </div>
          )}

          {importResults && (
            <Alert variant={importResults.failed > 0 ? "destructive" : "default"}>
              {importResults.failed > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Lyckade:</strong> {importResults.success}</p>
                  {importResults.skipped > 0 && (
                    <p><strong>Överhoppade (finns redan):</strong> {importResults.skipped}</p>
                  )}
                  <p><strong>Misslyckade:</strong> {importResults.failed}</p>
                  {importResults.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer">Visa fel</summary>
                      <ul className="mt-2 space-y-1 text-xs">
                        {importResults.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                        {importResults.errors.length > 10 && (
                          <li>... och {importResults.errors.length - 10} fler</li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}