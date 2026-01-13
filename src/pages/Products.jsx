import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Package, Edit2, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import ProductForm from '@/components/products/ProductForm';
import BOMEditor from '@/components/products/BOMEditor';
import { getStockSummary } from '@/components/inventory/StockCalculations';

const typeLabels = {
  finished_good: 'Färdigvara',
  raw_material: 'Råvara',
  packaging: 'Förpackning',
  label: 'Etikett'
};

const typeColors = {
  finished_good: 'bg-indigo-100 text-indigo-700',
  raw_material: 'bg-amber-100 text-amber-700',
  packaging: 'bg-cyan-100 text-cyan-700',
  label: 'bg-pink-100 text-pink-700'
};

export default function Products() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showBOM, setShowBOM] = useState(null);

  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items'],
    queryFn: () => base44.entities.BOMItem.list()
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.InventoryLedger.list('-created_date', 500)
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
      setEditingProduct(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  const saveBOMMutation = useMutation({
    mutationFn: async ({ productId, items }) => {
      // Delete existing BOM items
      const existing = bomItems.filter(b => b.finished_product_id === productId);
      for (const item of existing) {
        await base44.entities.BOMItem.delete(item.id);
      }
      // Create new items
      for (const item of items) {
        await base44.entities.BOMItem.create({
          finished_product_id: productId,
          component_id: item.component_id,
          quantity_per_unit: item.quantity_per_unit,
          notes: item.notes
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
      setShowBOM(null);
    }
  });

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        if (activeTab !== 'all' && p.type !== activeTab) return false;
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return p.sku?.toLowerCase().includes(search) || 
                 p.name?.toLowerCase().includes(search);
        }
        return true;
      })
      .sort((a, b) => a.sku?.localeCompare(b.sku));
  }, [products, activeTab, searchTerm]);

  const stockData = useMemo(() => {
    const data = {};
    products.forEach(product => {
      data[product.id] = getStockSummary(product, ledger, batches);
    });
    return data;
  }, [products, ledger, batches]);

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleSave = (data) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <ProductForm
            product={editingProduct}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingProduct(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (showBOM) {
    const product = products.find(p => p.id === showBOM);
    const productBOM = bomItems
      .filter(b => b.finished_product_id === showBOM)
      .map(b => {
        const component = products.find(p => p.id === b.component_id);
        return {
          ...b,
          component_sku: component?.sku,
          component_name: component?.name,
          component_unit: component?.unit
        };
      });

    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Button variant="ghost" onClick={() => setShowBOM(null)}>
              ← Tillbaka
            </Button>
          </div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">{product?.sku} - {product?.name}</h2>
          </div>
          <BOMEditor
            productId={showBOM}
            productUnit={product?.unit}
            bomItems={productBOM}
            availableComponents={products}
            onSave={(items) => saveBOMMutation.mutate({ productId: showBOM, items })}
            isLoading={saveBOMMutation.isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Produkter</h1>
            <p className="text-slate-500 mt-1">Hantera produkter, råvaror och förpackningar</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Ny produkt
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök SKU eller namn..."
                className="pl-10"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Alla</TabsTrigger>
                <TabsTrigger value="finished_good">Färdigvaror</TabsTrigger>
                <TabsTrigger value="raw_material">Råvaror</TabsTrigger>
                <TabsTrigger value="packaging">Förpackning</TabsTrigger>
                <TabsTrigger value="label">Etiketter</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Card>

        {/* Products Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Namn</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>I lager</TableHead>
                <TableHead>Säkerhet</TableHead>
                <TableHead>Ledtid</TableHead>
                <TableHead className="text-right">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const stock = stockData[product.id] || { onHand: 0 };
                const hasBOM = bomItems.some(b => b.finished_product_id === product.id);
                
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono font-medium">{product.sku}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>
                      <Badge className={cn(typeColors[product.type], "font-normal")}>
                        {typeLabels[product.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(
                      "font-semibold",
                      stock.belowSafety && "text-amber-600"
                    )}>
                      {stock.onHand?.toLocaleString('sv-SE')} {product.unit}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {product.safety_stock?.toLocaleString('sv-SE') || '-'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {product.lead_time_days ? `${product.lead_time_days} dagar` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {product.type === 'finished_good' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowBOM(product.id)}
                            className={hasBOM ? 'text-indigo-600' : 'text-slate-400'}
                          >
                            BOM
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            if (confirm('Är du säker på att du vill ta bort denna produkt?')) {
                              deleteMutation.mutate(product.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Inga produkter hittades</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}