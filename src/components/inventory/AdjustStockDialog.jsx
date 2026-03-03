import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { evaluateInventoryAlerts } from "@/components/alerts/AlertEvaluator";

export default function AdjustStockDialog({ product, stockSummary, open, onOpenChange, onSaved }) {
  const [type, setType] = useState("inbound");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const onHand = stockSummary?.onHand ?? 0;
  const available = stockSummary?.available ?? 0;

  const unit = product?.unit || "st";

  const handleSave = async () => {
    const parsed = Number(qty);
    if (!product?.id) return;
    if (!Number.isFinite(parsed)) {
      toast.error("Ange ett tal");
      return;
    }
    setSaving(true);
    try {
      const adjustedQty = parsed;

      await base44.entities.InventoryLedger.create({
        environment: 'production',
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        transaction_type: type,
        quantity: adjustedQty,
        reference_type: 'manual',
        notes: notes || `Manuell ${type}`
      });

      toast.success('Lager justerat');
      onSaved && onSaved();
      onOpenChange(false);
      setQty("");
      setNotes("");
      setType("inbound");

      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        await evaluateInventoryAlerts();
      } catch (err) {
        toast.message('Lager sparat, men notiser kunde inte uppdateras automatiskt.');
      }
    } catch (e) {
      toast.error('Kunde inte spara: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle>Justera lager – {product?.sku}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            Aktuellt saldo:
            <div className="mt-1 flex gap-2">
              <Badge variant="secondary">On hand: {onHand} {unit}</Badge>
              <Badge className="bg-blue-100 text-blue-700">Tillgängligt: {available} {unit}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Transaktionstyp</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inleverans</SelectItem>
                <SelectItem value="adjustment">Justering</SelectItem>
                <SelectItem value="scrap">Skrot</SelectItem>
                <SelectItem value="shipment">Utleverans</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Antal</Label>
            <Input type="number" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            <p className="text-xs text-slate-500">Positivt tal ökar lagret, negativt tal minskar lagret.</p>
          </div>

          <div className="space-y-2">
            <Label>Anteckningar</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Valfritt" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Sparar...' : 'Spara'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}