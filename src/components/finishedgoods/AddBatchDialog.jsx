import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function AddBatchDialog({ product, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    batch_number: '',
    quantity: '',
    production_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    status: 'available',
    notes: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const batch = await base44.entities.Batch.create({
        batch_number: data.batch_number,
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        produced_quantity: parseFloat(data.quantity),
        current_quantity: parseFloat(data.quantity),
        production_date: data.production_date,
        expiry_date: data.expiry_date || null,
        status: data.status,
        notes: data.notes
      });

      await base44.entities.InventoryLedger.create({
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        batch_id: batch.id,
        batch_number: data.batch_number,
        transaction_type: 'inbound',
        quantity: parseFloat(data.quantity),
        reference: `Batch ${data.batch_number}`,
        notes: 'Manuell batchregistrering'
      });

      return batch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      toast.success('Batch skapad');
      onOpenChange(false);
      setFormData({
        batch_number: '',
        quantity: '',
        production_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        status: 'available',
        notes: ''
      });
    },
    onError: (error) => {
      toast.error('Kunde inte skapa batch');
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.batch_number || !formData.quantity) {
      toast.error('Fyll i alla obligatoriska fält');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till batch</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {product.sku} - {product.name}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Batchnummer *</Label>
            <Input
              value={formData.batch_number}
              onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
              placeholder="t.ex. SCHAMPO-500-20260113-A1"
            />
          </div>

          <div>
            <Label>Antal {product.unit} *</Label>
            <Input
              type="number"
              step="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              placeholder="t.ex. 1000"
            />
          </div>

          <div>
            <Label>Produktionsdatum</Label>
            <Input
              type="date"
              value={formData.production_date}
              onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
            />
          </div>

          <div>
            <Label>Utgångsdatum (valfritt)</Label>
            <Input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Tillgänglig</SelectItem>
                <SelectItem value="quarantined">Karantän</SelectItem>
                <SelectItem value="blocked">Spärrad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Anteckningar</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Valfria anteckningar..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Skapa batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}