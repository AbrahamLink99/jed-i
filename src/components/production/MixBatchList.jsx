import React from 'react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

const statusColors = {
  available: 'bg-emerald-100 text-emerald-700',
  quarantined: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  closed: 'bg-slate-200 text-slate-600'
};

export default function MixBatchList({ mixBatches = [], onTap }) {
  const visible = (mixBatches || [])
    .filter(b => b.status === 'available' && (b.remaining_kg ?? 0) > 0);

  return (
    <Card className="p-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>mix_sku</TableHead>
            <TableHead>batch_no</TableHead>
            <TableHead className="text-right">produced_kg</TableHead>
            <TableHead className="text-right">remaining_kg</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((b) => (
            <TableRow key={b.id} className="hover:bg-slate-50">
              <TableCell className="font-mono text-sm">{b.mix_sku}</TableCell>
              <TableCell className="font-mono text-sm">{b.batch_no}</TableCell>
              <TableCell className="text-right">{b.produced_kg?.toLocaleString('sv-SE')}</TableCell>
              <TableCell className="text-right font-semibold">{b.remaining_kg?.toLocaleString('sv-SE')}</TableCell>
              <TableCell>
                <Badge className={`${statusColors[b.status] || 'bg-slate-100 text-slate-600'} font-normal text-xs`}>{b.status}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onTap?.(b)}>Tappa</Button>
              </TableCell>
            </TableRow>
          ))}
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-500 py-8">Inga blandningar tillgängliga</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}