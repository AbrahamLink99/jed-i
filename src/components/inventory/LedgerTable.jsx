import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";

const transactionLabels = {
  inbound: 'Inleverans',
  production: 'Produktion',
  backflush: 'Backflush',
  adjustment: 'Justering',
  scrap: 'Skrot',
  reservation: 'Reservation',
  release_reservation: 'Släpp reservation',
  shipment: 'Leverans'
};

const transactionColors = {
  inbound: 'bg-emerald-100 text-emerald-700',
  production: 'bg-indigo-100 text-indigo-700',
  backflush: 'bg-orange-100 text-orange-700',
  adjustment: 'bg-slate-100 text-slate-700',
  scrap: 'bg-red-100 text-red-700',
  reservation: 'bg-amber-100 text-amber-700',
  release_reservation: 'bg-cyan-100 text-cyan-700',
  shipment: 'bg-purple-100 text-purple-700'
};

export default function LedgerTable({ entries = [], showProduct = true }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Inga lagerhändelser</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            {showProduct && <TableHead>Produkt</TableHead>}
            <TableHead>Typ</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Kvantitet</TableHead>
            <TableHead>Referens</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-slate-500 whitespace-nowrap">
                {format(new Date(entry.created_date), 'd MMM HH:mm', { locale: sv })}
              </TableCell>
              {showProduct && (
                <TableCell>
                  <div>
                    <span className="font-mono text-sm">{entry.product_sku}</span>
                    {entry.product_name && (
                      <p className="text-sm text-slate-500 truncate max-w-[200px]">
                        {entry.product_name}
                      </p>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell>
                <Badge className={cn(transactionColors[entry.transaction_type], "font-normal")}>
                  {transactionLabels[entry.transaction_type] || entry.transaction_type}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm text-slate-500">
                {entry.batch_number || '-'}
              </TableCell>
              <TableCell>
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  entry.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {entry.quantity >= 0 ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                  {entry.quantity >= 0 ? '+' : ''}{entry.quantity?.toLocaleString('sv-SE')}
                </span>
              </TableCell>
              <TableCell className="text-slate-500 max-w-[200px] truncate">
                {entry.reference || entry.notes || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}