import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Loader2, Plus, ExternalLink, Trash2 } from 'lucide-react';

export default function ShopifyMappingDialog({ product, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    store: 'b2c',
    shopify_variant_id: '',
    shopify_product_id: ''
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['shopify_mappings', product.id],
    queryFn: () => base44.entities.ShopifyMapping.filter({ product_id: product.id }),
    enabled: open
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ShopifyMapping.create({
      product_id: product.id,
      product_sku: product.sku,
      store: data.store,
      shopify_variant_id: data.shopify_variant_id,
      shopify_product_id: data.shopify_product_id,
      active: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify_mappings'] });
      toast.success('Shopify-koppling skapad');
      setShowAddForm(false);
      setFormData({ store: 'b2c', shopify_variant_id: '', shopify_product_id: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ShopifyMapping.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify_mappings'] });
      toast.success('Koppling borttagen');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.shopify_variant_id) {
      toast.error('Shopify Variant ID krävs');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shopify-kopplingar</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {product.sku} - {product.name}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing mappings */}
          {mappings.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Aktiva kopplingar</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Butik</TableHead>
                    <TableHead>Variant ID</TableHead>
                    <TableHead>Senaste synk</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell>
                        <Badge variant={mapping.store === 'b2c' ? 'default' : 'secondary'}>
                          {mapping.store === 'b2c' ? 'B2C' : 'B2B'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {mapping.shopify_variant_id}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {mapping.last_sync_date ? new Date(mapping.last_sync_date).toLocaleDateString('sv-SE') : '-'}
                        {mapping.last_synced_quantity && ` (${mapping.last_synced_quantity} st)`}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(mapping.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Add new mapping */}
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Lägg till ny koppling
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4">
              <div>
                <Label>Butik</Label>
                <Select value={formData.store} onValueChange={(value) => setFormData({ ...formData, store: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2c">B2C (Konsumentbutik)</SelectItem>
                    <SelectItem value="b2b">B2B (Företagsbutik)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Shopify Variant ID *</Label>
                <Input
                  value={formData.shopify_variant_id}
                  onChange={(e) => setFormData({ ...formData, shopify_variant_id: e.target.value })}
                  placeholder="t.ex. 44782648713533"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Hittas i Shopify Admin → Produkter → Variant ID
                </p>
              </div>

              <div>
                <Label>Shopify Product ID (valfritt)</Label>
                <Input
                  value={formData.shopify_product_id}
                  onChange={(e) => setFormData({ ...formData, shopify_product_id: e.target.value })}
                  placeholder="t.ex. 8234567890123"
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Skapa koppling
                </Button>
              </div>
            </form>
          )}

          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p className="font-medium mb-2">💡 Så fungerar Shopify-synken</p>
            <ul className="space-y-1 text-xs">
              <li>• Lagersaldo i styck synkas automatiskt till Shopify</li>
              <li>• Buffert ({product.shopify_buffer || 0} st) dras alltid från tillgängligt antal</li>
              <li>• När order skapas i Shopify reserveras lagret automatiskt</li>
              <li>• Vid leverans släpps reservationen och lagret uppdateras</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}