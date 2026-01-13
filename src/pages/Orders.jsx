import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ShoppingCart, Plus, Search, Truck, Package, Store } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const statusColors = {
  pending: 'bg-slate-100 text-slate-700',
  reserved: 'bg-amber-100 text-amber-700',
  shipped: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700'
};

const statusLabels = {
  pending: 'Väntar',
  reserved: 'Reserverad',
  shipped: 'Levererad',
  cancelled: 'Avbruten'
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({
    shopify_order_id: '',
    shopify_order_number: '',
    store: 'b2c',
    customer_name: '',
    line_items: []
  });

  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['shopify-orders'],
    queryFn: () => base44.entities.ShopifyOrder.list('-created_date')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const finishedProducts = products.filter(p => p.type === 'finished_good');

  const createOrderMutation = useMutation({
    mutationFn: async (orderData) => {
      const order = await base44.entities.ShopifyOrder.create({
        ...orderData,
        order_date: new Date().toISOString(),
        status: 'reserved'
      });

      // Create reservations for each line item
      for (const item of orderData.line_items) {
        await base44.entities.InventoryLedger.create({
          product_id: item.product_id,
          product_sku: item.product_sku,
          transaction_type: 'reservation',
          quantity: -item.quantity, // Negative for reservation
          reference: `Order: ${orderData.shopify_order_number}`
        });
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      setShowCreateOrder(false);
      setNewOrder({
        shopify_order_id: '',
        shopify_order_number: '',
        store: 'b2c',
        customer_name: '',
        line_items: []
      });
      toast.success('Order skapad');
    }
  });

  const shipOrderMutation = useMutation({
    mutationFn: async (order) => {
      // Update order status
      await base44.entities.ShopifyOrder.update(order.id, { status: 'shipped' });

      // Convert reservations to shipments
      for (const item of order.line_items || []) {
        // Release reservation
        await base44.entities.InventoryLedger.create({
          product_id: item.product_id,
          product_sku: item.product_sku,
          transaction_type: 'release_reservation',
          quantity: item.quantity,
          reference: `Order levererad: ${order.shopify_order_number}`
        });

        // Create shipment (actual reduction)
        await base44.entities.InventoryLedger.create({
          product_id: item.product_id,
          product_sku: item.product_sku,
          transaction_type: 'shipment',
          quantity: -item.quantity,
          reference: `Leverans: ${order.shopify_order_number}`
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      toast.success('Order markerad som levererad');
    }
  });

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (storeFilter !== 'all' && order.store !== storeFilter) return false;
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          order.shopify_order_number?.toLowerCase().includes(search) ||
          order.customer_name?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [orders, storeFilter, statusFilter, searchTerm]);

  const addLineItem = () => {
    setNewOrder({
      ...newOrder,
      line_items: [...newOrder.line_items, { product_id: '', product_sku: '', quantity: 1 }]
    });
  };

  const updateLineItem = (index, field, value) => {
    const items = [...newOrder.line_items];
    items[index] = { ...items[index], [field]: value };
    
    if (field === 'product_id') {
      const product = finishedProducts.find(p => p.id === value);
      items[index].product_sku = product?.sku || '';
    }
    
    setNewOrder({ ...newOrder, line_items: items });
  };

  const removeLineItem = (index) => {
    setNewOrder({
      ...newOrder,
      line_items: newOrder.line_items.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ordrar</h1>
            <p className="text-slate-500 mt-1">Hantera Shopify-ordrar och reservationer</p>
          </div>
          <Dialog open={showCreateOrder} onOpenChange={setShowCreateOrder}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Skapa order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Skapa order manuellt</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ordernummer</Label>
                    <Input
                      value={newOrder.shopify_order_number}
                      onChange={(e) => setNewOrder({ ...newOrder, shopify_order_number: e.target.value, shopify_order_id: e.target.value })}
                      placeholder="#1001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Butik</Label>
                    <Select value={newOrder.store} onValueChange={(v) => setNewOrder({ ...newOrder, store: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="b2c">B2C</SelectItem>
                        <SelectItem value="b2b">B2B</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Kundnamn</Label>
                  <Input
                    value={newOrder.customer_name}
                    onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })}
                    placeholder="Kundens namn"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Orderrader</Label>
                    <Button variant="outline" size="sm" onClick={addLineItem}>
                      <Plus className="w-4 h-4 mr-1" />
                      Lägg till
                    </Button>
                  </div>
                  
                  {newOrder.line_items.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">Inga produkter tillagda</p>
                  ) : (
                    <div className="space-y-2">
                      {newOrder.line_items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                          <Select 
                            value={item.product_id} 
                            onValueChange={(v) => updateLineItem(idx, 'product_id', v)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Välj produkt..." />
                            </SelectTrigger>
                            <SelectContent>
                              {finishedProducts.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-24"
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeLineItem(idx)}
                            className="text-red-500"
                          >
                            Ta bort
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowCreateOrder(false)}>
                    Avbryt
                  </Button>
                  <Button 
                    onClick={() => createOrderMutation.mutate(newOrder)}
                    disabled={!newOrder.shopify_order_number || newOrder.line_items.length === 0 || createOrderMutation.isPending}
                  >
                    {createOrderMutation.isPending ? 'Skapar...' : 'Skapa order'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök ordernummer eller kund..."
                className="pl-10"
              />
            </div>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Alla butiker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla butiker</SelectItem>
                <SelectItem value="b2c">B2C</SelectItem>
                <SelectItem value="b2b">B2B</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Alla statusar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla statusar</SelectItem>
                <SelectItem value="pending">Väntar</SelectItem>
                <SelectItem value="reserved">Reserverad</SelectItem>
                <SelectItem value="shipped">Levererad</SelectItem>
                <SelectItem value="cancelled">Avbruten</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Orders Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Butik</TableHead>
                <TableHead>Kund</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Produkter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">
                    {order.shopify_order_number}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Store className="w-3 h-3" />
                      {order.store?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.customer_name || '-'}</TableCell>
                  <TableCell className="text-slate-500">
                    {order.order_date && format(new Date(order.order_date), 'd MMM HH:mm', { locale: sv })}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {order.line_items?.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-mono">{item.product_sku}</span>
                          <span className="text-slate-500 ml-2">× {item.quantity}</span>
                        </div>
                      ))}
                      {(order.line_items?.length || 0) > 2 && (
                        <p className="text-xs text-slate-500">+{order.line_items.length - 2} till</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(statusColors[order.status], "font-normal")}>
                      {statusLabels[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === 'reserved' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => shipOrderMutation.mutate(order)}
                        disabled={shipOrderMutation.isPending}
                      >
                        <Truck className="w-4 h-4 mr-1" />
                        Leverera
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Inga ordrar hittades</p>
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