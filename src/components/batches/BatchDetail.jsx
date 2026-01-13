import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { X, Package, Calendar, Hash, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const statusColors = {
  available: 'bg-emerald-100 text-emerald-700',
  quarantined: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  depleted: 'bg-slate-100 text-slate-500'
};

const statusLabels = {
  available: 'Tillgänglig',
  quarantined: 'Karantän',
  blocked: 'Spärrad',
  depleted: 'Slut'
};

const transactionLabels = {
  production: 'Produktion',
  backflush: 'Backflush',
  adjustment: 'Justering',
  scrap: 'Skrot',
  reservation: 'Reservation',
  release_reservation: 'Släpp reservation',
  shipment: 'Leverans',
  inbound: 'Inleverans'
};

export default function BatchDetail({ 
  batch, 
  ledgerEntries = [], 
  onClose, 
  onStatusChange,
  isUpdating 
}) {
  if (!batch) return null;

  const batchLedger = ledgerEntries
    .filter(e => e.batch_id === batch.id)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <Card className="p-6 border-slate-200">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-100">
            <Package className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 font-mono">
              {batch.batch_number}
            </h2>
            <p className="text-slate-500">{batch.product_name || batch.product_sku}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Status</p>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[batch.status]}>
              {statusLabels[batch.status]}
            </Badge>
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Kvar i lager</p>
          <p className="text-2xl font-semibold text-slate-900">
            {batch.current_quantity?.toLocaleString('sv-SE')}
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Ursprunglig mängd</p>
          <p className="text-2xl font-semibold text-slate-900">
            {batch.produced_quantity?.toLocaleString('sv-SE')}
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Produktionsdatum</p>
          <p className="text-lg font-medium text-slate-900">
            {batch.production_date && format(new Date(batch.production_date), 'd MMM yyyy', { locale: sv })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 rounded-lg">
        <span className="text-sm text-slate-600">Ändra status:</span>
        <Select 
          value={batch.status} 
          onValueChange={(value) => onStatusChange(batch.id, value)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Tillgänglig</SelectItem>
            <SelectItem value="quarantined">Karantän</SelectItem>
            <SelectItem value="blocked">Spärrad</SelectItem>
            <SelectItem value="depleted">Slut</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <h3 className="font-medium text-slate-900 mb-3">Lagerhistorik</h3>
        {batchLedger.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Ingen historik för denna batch</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kvantitet</TableHead>
                <TableHead>Referens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchLedger.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-slate-500">
                    {format(new Date(entry.created_date), 'd MMM HH:mm', { locale: sv })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {transactionLabels[entry.transaction_type] || entry.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1 font-medium ${
                      entry.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {entry.quantity >= 0 ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                      {entry.quantity >= 0 ? '+' : ''}{entry.quantity?.toLocaleString('sv-SE')}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {entry.reference || entry.notes || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}