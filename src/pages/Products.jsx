import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Package, Edit2, Trash2, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import ProductForm from '@/components/products/ProductForm';
import BOMEditor from '@/components/products/BOMEditor';
import AddBatchDialog from '@/components/finishedgoods/AddBatchDialog';
import AdjustStockDialog from '@/components/inventory/AdjustStockDialog.jsx';
import { getStockSummary } from '@/components/inventory/StockCalculations';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';

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

const brandLabels = {
  own: 'BRUNS',
  client_a: 'Kund A',
  client_b: 'Kund B',
  other: 'Övrigt'
};

const brandColors = {
  own: 'bg-blue-100 text-blue-800 border-blue-300',
  client_a: 'bg-green-100 text-green-800 border-green-300',
  client_b: 'bg-purple-100 text-purple-800 border-purple-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300'
};

export default function Products() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('sku');
  const [sortDir, setSortDir] = useState('asc');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showBOM, setShowBOM] = useState(null);
  const [showAddBatch, setShowAddBatch] = useState(null);
  const [adjustProduct, setAdjustProduct] = useState(null);

  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', envFilter.environment],
    queryFn: () => base44.entities.Product.filter(envFilter)
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items', envFilter.environment],
    queryFn: () => base44.entities.BOMItem.filter(envFilter)
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger', envFilter.environment],
    queryFn: () => base44.entities.InventoryLedger.filter(envFilter, '-created_date', 1000)
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches', envFilter.environment],
    queryFn: () => base44.entities.Batch.filter(envFilter)
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create({ ...data, environment: envFilter.environment }),
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
          environment: envFilter.environment,
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

  /* moved: see below after stockData */

  const stockData = useMemo(() => {
    const ledgerForEnv = ledger.filter(e => !e.environment || e.environment === envFilter.environment);
    const data = {};
    products.forEach(product => {
      data[product.id] = getStockSummary(product, ledgerForEnv, batches);
    });
    return data;
  }, [products, ledger, batches, envFilter.environment]);

  const suppliers = useMemo(() => {
    return Array.from(new Set(products.map(p => p.supplier).filter(Boolean))).sort();
  }, [products]);

  const tagsById = useMemo(() => {
    const m = {};
    (tags || []).forEach(t => { m[t.id] = t; });
    return m;
  }, [tags]);

  const filteredProducts = useMemo(() => {
    const arr = products.filter(p => {
      if (activeTab !== 'all' && p.type !== activeTab) return false;
      if (brandFilter !== 'all' && (p.brand || 'own') !== brandFilter) return false;
      if (supplierFilter !== 'all' && (p.supplier || '') !== supplierFilter) return false;
      if (stockFilter !== 'all') {
        const s = stockData[p.id] || { onHand: 0 };
        if (stockFilter === 'out' && s.onHand > 0) return false;
        if (stockFilter === 'below' && !(s.onHand < (p.safety_stock || 0))) return false;
        if (stockFilter === 'in' && s.onHand <= 0) return false;
      }
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return p.sku?.toLowerCase().includes(search) || p.name?.toLowerCase().includes(search);
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const compare = (a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '') * dir;
        case 'stock': {
          const sa = (stockData[a.id]?.onHand || 0);
          const sb = (stockData[b.id]?.onHand || 0);
          return (sa - sb) * dir;
        }
        case 'supplier':
          return (a.supplier || '').localeCompare(b.supplier || '') * dir;
        case 'cost':
          return ((a.cost_per_unit || 0) - (b.cost_per_unit || 0)) * dir;
        case 'sku':
        default:
          return (a.sku || '').localeCompare(b.sku || '') * dir;
      }
    };

    return arr.sort(compare);
  }, [products, stockData, activeTab, brandFilter, supplierFilter, stockFilter, searchTerm, sortBy, sortDir]);

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
            <h1 className="text-3xl font-bold text-slate-900">Artiklar</h1>
            <p className="text-slate-500 mt-1">Hantera artiklar, råvaror och förpackningar</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Ny artikel
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col gap-4">
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
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Varumärke" />
                </SelectTrigger>
                <SelectContent>
                 <SelectItem value="all">Alla varumärken</SelectItem>
                 <SelectItem value="own">BRUNS</SelectItem>
                 <SelectItem value="client_a">Kund A</SelectItem>
                 <SelectItem value="client_b">Kund B</SelectItem>
                 <SelectItem value="other">Övrigt</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Leverantör" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla leverantörer</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Lagerstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All lagerstatus</SelectItem>
                  <SelectItem value="in">I lager</SelectItem>
                  <SelectItem value="below">Under säkerhetslager</SelectItem>
                  <SelectItem value="out">Slut</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sortera efter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="name">Namn</SelectItem>
                  <SelectItem value="stock">Lager</SelectItem>
                  <SelectItem value="supplier">Leverantör</SelectItem>
                  <SelectItem value="cost">Kostnad</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortDir} onValueChange={setSortDir}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Riktning" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Stigande</SelectItem>
                  <SelectItem value="desc">Fallande</SelectItem>
                </SelectContent>
              </Select>
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
                <TableHead>Tillgängligt</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.name}
                        <Badge variant="outline" className={`text-xs ${brandColors[product.brand || 'own']}`}>
                          {brandLabels[product.brand || 'own']}
                        </Badge>
                        <div className="flex flex-wrap gap-1">
                          {(product.tag_ids || []).map((tid) => (
                            <Badge key={tid} variant="secondary" className="text-xs">
                              {tagsById[tid]?.name || 'Tagg'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>
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
                      {(stock.available ?? 0).toLocaleString('sv-SE')} {product.unit}
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
                        {(product.type === 'raw_material' || product.type === 'packaging' || product.type === 'label') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowAddBatch(product)}
                            className="text-cyan-600"
                          >
                            + Batch
                          </Button>
                        )}
                        <Link to={createPageUrl('ProductDetail') + `?productId=${product.id}`}>
                          <Button variant="ghost" size="sm" className="text-slate-600">
                            <Eye className="w-4 h-4 mr-1" /> Detaljer
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAdjustProduct(product)}
                          className="text-slate-700"
                        >
                          Justera lager
                        </Button>
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
                            if (confirm('Är du säker på att du vill ta bort denna artikel?')) {
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
                    <p>Inga artiklar hittades</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Add Batch Dialog */}
        {showAddBatch && (
          <AddBatchDialog
            product={showAddBatch}
            open={!!showAddBatch}
            onOpenChange={(open) => !open && setShowAddBatch(null)}
          />
        )}

        {/* Adjust Stock Dialog */}
        {adjustProduct && (
          <AdjustStockDialog
            product={adjustProduct}
            stockSummary={stockData[adjustProduct.id]}
            open={!!adjustProduct}
            onOpenChange={(open) => !open && setAdjustProduct(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['ledger'] });
            }}
          />
        )}

        {/* Quick Edit Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingProduct(null); } }}>
          <DialogContent className="max-w-3xl w-[95vw] sm:w-auto max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overscroll-contain">
            <DialogHeader>
              <DialogTitle>{editingProduct ? `Redigera ${editingProduct.sku}` : 'Ny produkt'}</DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingProduct(null); }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}