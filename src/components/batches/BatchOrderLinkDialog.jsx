import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function BatchOrderLinkDialog({ batch, open, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [qty, setQty] = useState('');
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['shopify-orders', searchTerm],
    queryFn: async () => {
      const allOrders = await base44.entities.ShopifyOrderRef.list();
      if (!searchTerm) return allOrders;
      return allOrders.filter(o => 
        o.shopify_order_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    },
    enabled: open
  });

  const { data: availableQty } = useQuery({
    queryKey: ['batch-available', batch?.id],
    queryFn: async () => {
      if (!batch) return 0;
      const ledger = await base44.entities.InventoryLedger.list();
      const batchEntries = ledger.filter(l => l.batch_lot_id === batch.id);
      return batchEntries.reduce((sum, e) => sum + e.quantity, 0);
    },
    enabled: !!batch
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      // Create link
      await base44.entities.BatchOrderLink.create({
        batch_lot_id: batch.id,
        batch_number: batch.batch_number,
        store_id: selectedOrder.store_id,
        shopify_order_id: selectedOrder.shopify_order_id,
        shopify_order_number: selectedOrder.shopify_order_number,
        sku: batch.finished_sku,
        qty_from_batch: parseFloat(qty),
        linked_at: new Date().toISOString(),
        linked_by: user.email
      });

      // Create inventory ledger entry
      await base44.entities.InventoryLedger.create({
        product_id: batch.product_id,
        product_sku: batch.finished_sku,
        product_name: batch.product_name,
        batch_lot_id: batch.id,
        batch_number: batch.batch_number,
        transaction_type: 'pick',
        quantity: -parseFloat(qty),
        reference_type: 'shopify_order',
        reference_id: selectedOrder.shopify_order_id,
        store_id: selectedOrder.store_id,
        notes: `Picked for order ${selectedOrder.shopify_order_number}`
      });
    },
    onSuccess: () => {
      toast.success('Batch länkad till order');
      queryClient.invalidateQueries(['batch-available']);
      queryClient.invalidateQueries(['batch-links']);
      setSelectedOrder(null);
      setQty('');
      onClose();
    },
    onError: (error) => {
      toast.error('Kunde inte länka: ' + error.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Länka batch till Shopify-order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-100 p-4 rounded-lg space-y-2">
            <p className="text-sm"><strong>Batch:</strong> {batch?.batch_number}</p>
            <p className="text-sm"><strong>SKU:</strong> {batch?.finished_sku}</p>
            <p className="text-sm"><strong>Tillgängligt:</strong> {availableQty} st</p>
          </div>

          <div className="space-y-2">
            <Label>Sök Shopify-ordernummer</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Sök ordernummer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button variant="outline" size="icon">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {searchTerm && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {orders.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 text-center">Inga ordrar hittades</p>
              ) : (
                <div className="divide-y">
                  {orders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`w-full p-3 text-left hover:bg-slate-50 transition ${
                        selectedOrder?.id === order.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.shopify_order_number}</p>
                          <p className="text-sm text-slate-500">
                            {new Date(order.order_created_at).toLocaleDateString('sv-SE')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{order.store_id}</Badge>
                          <Badge>{order.status}</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedOrder && (
            <div className="space-y-3 border-t pt-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium">Vald order: {selectedOrder.shopify_order_number}</p>
              </div>

              <div className="space-y-2">
                <Label>Antal att plocka från denna batch</Label>
                <Input
                  type="number"
                  placeholder="Antal..."
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  max={availableQty}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Avbryt
                </Button>
                <Button 
                  onClick={() => linkMutation.mutate()}
                  disabled={!qty || parseFloat(qty) <= 0 || parseFloat(qty) > availableQty}
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Länka batch
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}