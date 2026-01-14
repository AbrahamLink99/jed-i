import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function AcknowledgeOrderDialog({ alert, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    ordered_qty: alert.suggested_order_qty || 0,
    supplier: '',
    order_reference: '',
    notes: ''
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      
      await base44.entities.InventoryAlert.update(alert.id, {
        status: 'ORDERED_ACKNOWLEDGED',
        ordered_qty: parseFloat(data.ordered_qty),
        supplier: data.supplier || null,
        order_reference: data.order_reference,
        ordered_by: user.email,
        ordered_at: new Date().toISOString(),
        notes: data.notes || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_alerts'] });
      toast.success('Beställning bekräftad');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Kunde inte bekräfta beställning');
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.order_reference) {
      toast.error('Orderreferens är obligatorisk');
      return;
    }
    
    if (!formData.ordered_qty || formData.ordered_qty <= 0) {
      toast.error('Antal måste vara större än 0');
      return;
    }

    acknowledgeMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bekräfta beställning</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {alert.product_sku} - {alert.product_name}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-slate-600">Tillgängligt lager:</span>
              <span className="font-medium">{alert.current_available_qty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Beställningspunkt:</span>
              <span className="font-medium">{alert.reorder_point}</span>
            </div>
          </div>

          <div>
            <Label>Antal att beställa *</Label>
            <Input
              type="number"
              step="1"
              value={formData.ordered_qty}
              onChange={(e) => setFormData({ ...formData, ordered_qty: e.target.value })}
              placeholder="Antal enheter"
            />
          </div>

          <div>
            <Label>Leverantör (valfritt)</Label>
            <Input
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="t.ex. Acme Supply Co"
            />
          </div>

          <div>
            <Label>Orderreferens *</Label>
            <Input
              value={formData.order_reference}
              onChange={(e) => setFormData({ ...formData, order_reference: e.target.value })}
              placeholder="t.ex. PO-2026-001 eller fritext"
            />
            <p className="text-xs text-slate-500 mt-1">
              Inköpsorder-ID eller annan referens som visar att beställning är gjord
            </p>
          </div>

          <div>
            <Label>Anteckningar (valfritt)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ytterligare information..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={acknowledgeMutation.isPending}>
              {acknowledgeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Bekräfta beställning
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}