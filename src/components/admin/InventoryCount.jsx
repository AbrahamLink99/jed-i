import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getStockSummary } from '@/components/inventory/StockCalculations';

const PRODUCT_CATEGORIES = [
  { value: 'raw_material', label: 'Råvaror' },
  { value: 'finished_good', label: 'Färdigvaror' },
  { value: 'packaging', label: 'Förpackningar' },
  { value: 'label', label: 'Etiketter' }
];

export default function InventoryCount() {
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [activeCategory, setActiveCategory] = useState('raw_material');
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.InventoryLedger.list('created_date', 5000),
    staleTime: 0
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list()
  });

  const importMutation = useMutation({
    mutationFn: async (adjustments) => {
      const results = [];
      for (const adj of adjustments) {
        try {
          await base44.entities.InventoryLedger.create({
            product_id: adj.product_id,
            product_sku: adj.sku,
            product_name: adj.name,
            transaction_type: 'adjustment',
            quantity: adj.adjustment,
            reference_type: 'manual',
            notes: `Inventering: ${adj.counted} räknat, ${adj.system} i system`
          });
          results.push({ sku: adj.sku, success: true });
        } catch (error) {
          results.push({ sku: adj.sku, success: false, error: error.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      setImportResult({ success, failed, details: results });
      toast.success(`Import klar: ${success} OK, ${failed} fel`);
      setFile(null);
    }
  });

  // Export current inventory to CSV for specific category
  const handleExport = (category) => {
    const filteredProducts = products.filter(p => p.type === category);
    const stockData = filteredProducts.map(product => {
      const stock = getStockSummary(product, ledger, batches);
      return {
        SKU: product.sku,
        Namn: product.name,
        Typ: product.type,
        Enhet: product.unit,
        'I system': stock.onHand || 0,
        'Räknat': '', // Empty for user to fill in
        Anteckningar: ''
      };
    });

    // Convert to CSV
    const headers = Object.keys(stockData[0]);
    const csvContent = [
      headers.join(';'),
      ...stockData.map(row => 
        headers.map(h => {
          const value = row[h];
          // Escape values that contain semicolon or quotes
          if (typeof value === 'string' && (value.includes(';') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(';')
      )
    ].join('\n');

    // Add BOM for Excel to recognize UTF-8
    const categoryLabel = PRODUCT_CATEGORIES.find(c => c.value === category)?.label || category;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventering_${categoryLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Inventeringslista för ${categoryLabel} exporterad`);
  };

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    
    const rows = lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ';' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    });
    
    return rows;
  };

  // Import CSV file
  const handleImport = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const rows = parseCSV(text);
        
        const adjustments = [];
        for (const row of rows) {
          const sku = row.SKU || row.sku;
          const counted = parseFloat(row['Räknat'] || row.counted || '0');
          const system = parseFloat(row['I system'] || row.system || '0');
          
          if (!sku || isNaN(counted)) continue;
          
          const product = products.find(p => p.sku === sku);
          if (!product) {
            toast.error(`SKU ${sku} hittades inte`);
            continue;
          }
          
          const adjustment = counted - system;
          if (adjustment !== 0) {
            adjustments.push({
              product_id: product.id,
              sku: product.sku,
              name: product.name,
              system,
              counted,
              adjustment
            });
          }
        }

        if (adjustments.length === 0) {
          toast.error('Inga justeringar att importera');
          return;
        }

        importMutation.mutate(adjustments);
      } catch (error) {
        toast.error('Fel vid filläsning: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <FileSpreadsheet className="w-4 h-4" />
        <AlertDescription>
          <p className="font-medium mb-2">Så här fungerar det:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Välj kategori och exportera inventeringslista (CSV-fil)</li>
            <li>Öppna filen i Excel och fyll i kolumnen "Räknat" med faktiskt antal</li>
            <li>Spara filen och importera den i samma kategori</li>
            <li>Systemet skapar automatiskt justeringstransaktioner för differenser</li>
          </ol>
        </AlertDescription>
      </Alert>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-4">
          {PRODUCT_CATEGORIES.map(cat => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PRODUCT_CATEGORIES.map(cat => (
          <TabsContent key={cat.value} value={cat.value} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Exportera inventeringslista - {cat.label}</CardTitle>
                <CardDescription>
                  Ladda ner en CSV-fil med alla {cat.label.toLowerCase()} och nuvarande lagerstatus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => handleExport(cat.value)} className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Ladda ner {cat.label} (CSV)
                </Button>
                <p className="text-sm text-slate-500 mt-3">
                  {products.filter(p => p.type === cat.value).length} artiklar i denna kategori
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Importera inventeringsdata - {cat.label}</CardTitle>
                <CardDescription>
                  Ladda upp ifylld CSV-fil för att justera lagersaldo automatiskt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`file-${cat.value}`}>Välj CSV-fil</Label>
                  <Input
                    id={`file-${cat.value}`}
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <p className="text-xs text-slate-500">
                    Format: CSV med kolumner SKU, Räknat (obligatoriska)
                  </p>
                </div>

                <Button 
                  onClick={handleImport}
                  disabled={!file || importMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importMutation.isPending ? 'Importerar...' : 'Importera och justera lager'}
                </Button>

                {importResult && (
                  <Alert className={importResult.failed > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
                    <AlertDescription>
                      <div className="flex items-start gap-2">
                        {importResult.failed === 0 ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">Import slutförd</p>
                          <p className="text-sm mt-1">
                            {importResult.success} artiklar justerade, {importResult.failed} fel
                          </p>
                          {importResult.failed > 0 && (
                            <div className="mt-2 space-y-1">
                              {importResult.details.filter(d => !d.success).map((d, i) => (
                                <p key={i} className="text-xs text-red-600">
                                  {d.sku}: {d.error}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}