import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function DeprioritizeDialog({ alert, open, onOpenChange, onConfirm }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open, alert?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Markera som ej prioriterad</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Du kan ange en valfri kommentar (t.ex. "Inväntar leverantör" eller "Säsong slut").
          </p>
          <div className="space-y-1">
            <Label htmlFor="deprioritize-reason">Kommentar</Label>
            <Textarea id="deprioritize-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Valfri kommentar" rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={() => onConfirm(reason)}>Bekräfta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}