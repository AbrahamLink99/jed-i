import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ReceiveDialog({ alert, open, onOpenChange, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Markera som mottagen</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-600">
          Markera som mottagen – notisen stängs och tas bort från listan.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={onConfirm}>Bekräfta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}