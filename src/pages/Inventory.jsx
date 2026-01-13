import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, FileText } from 'lucide-react';
import InventoryTable from '@/components/inventory/InventoryTable';
import LedgerTable from '@/components/inventory/LedgerTable';
import { getStockSummary } from '@/components/inventory/StockCalculations';
import { toast } from 'sonner';

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('stock');
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    product_id: '',
    quantity: '',
    type: 'adjustment',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list()
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.InventoryLedger.list('-created_date', 500)
  });

  const adjustmentMutation = useMutation({
    mutationFn: async (data) => {
      const product = products.find(p => p.id === data.product_id);
      await base44.entities.InventoryLedger.create({
        product_id: data.product_id,
        product_sku: product?.sku,
        product_name: product?.name,
        transaction_type: data.type,
        quantity: parseFloat(data.quantity),
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      setShowAdjustment(false);
      setAdjustmentData({ product_id: '', quantity: '', type: 'adjustment', notes: '' });
      toast.success('Lagerjustering registrerad');
    }
  });

  const stockData = useMemo(() => {
    const data = {};
    products.forEach(product => {
      data[product.id] = getStockSummary(product, ledger, batches);
    });
    return data;
  }, [products, ledger, batches]);

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        if (typeFilter !== 'all' && p.type !== typeFilter) return false;
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return p.sku?.toLowerCase().includes(search) || 
                 p.name?.toLowerCase().includes(search);
        }
        return true;
      })
      .sort((a, b) => a.sku?.localeCompare(b.sku));
  }, [products, typeFilter, searchTerm]);

  const recentLedger = ledger.slice(0, 50);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lager</h1>
            <p className="text-slate-500 mt-1">Aktuella saldon och lagerhistorik</p>
          </div>
          <Dialog open={showAdjustment} onOpenChange={setShowAdjustment}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Lagerjustering
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrera lagerjustering</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Produkt</Label>
                  <Select 
                    value={adjustmentData.product_id} 
                    onValueChange={(v) => setAdjustmentData({ ...adjustmentData, product_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj produkt..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.sku} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select 
                    value={adjustmentData.type} 
                    onValueChange={(v) => setAdjustmentData({ ...adjustmentData, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inleverans (+)</SelectItem>
                      <SelectItem value="adjustment">Justering (+/-)</SelectItem>
                      <SelectItem value="scrap">Skrot (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Kvantitet (positiv eller negativ)</Label>
                  <Input
                    type="number"
                    value={adjustmentData.quantity}
                    onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
                    placeholder="T.ex. 100 eller -50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Anteckning</Label>
                  <Textarea
                    value={adjustmentData.notes}
                    onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                    placeholder="Anledning till justering..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowAdjustment(false)}>
                    Avbryt
                  </Button>
                  <Button 
                    onClick={() => adjustmentMutation.mutate(adjustmentData)}
                    disabled={!adjustmentData.product_id || !adjustmentData.quantity || adjustmentMutation.isPending}
                  >
                    {adjustmentMutation.isPending ? 'Sparar...' : 'Spara'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="stock">Lagersaldo</TabsTrigger>
            <TabsTrigger value="ledger">Lagerlogg</TabsTrigger>
          </TabsList>

          <TabsContent value="stock">
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Alla typer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla typer</SelectItem>
                    <SelectItem value="finished_good">Färdigvaror</SelectItem>
                    <SelectItem value="raw_material">Råvaror</SelectItem>
                    <SelectItem value="packaging">Förpackning</SelectItem>
                    <SelectItem value="label">Etiketter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Stock Table */}
            <Card className="overflow-hidden">
              <InventoryTable
                products={filteredProducts}
                stockData={stockData}
              />
            </Card>
          </TabsContent>

          <TabsContent value="ledger">
            <Card className="overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Senaste lagerhändelser
                </h3>
              </div>
              <LedgerTable entries={recentLedger} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}