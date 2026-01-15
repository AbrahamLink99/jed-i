import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function BatchLinksTable({ batchLotId }) {
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['batch-links', batchLotId],
    queryFn: async () => {
      const allLinks = await base44.entities.BatchOrderLink.list();
      return allLinks.filter(l => l.batch_lot_id === batchLotId);
    }
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Laddar...</p>;
  }

  if (links.length === 0) {
    return (
      <p className="text-sm text-slate-500 p-4 text-center border rounded-lg">
        Ingen batch har länkats till Shopify-ordrar ännu
      </p>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ordernummer</TableHead>
            <TableHead>Butik</TableHead>
            <TableHead>Antal</TableHead>
            <TableHead>Länkad</TableHead>
            <TableHead>Av</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map(link => (
            <TableRow key={link.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {link.shopify_order_number}
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{link.store_id}</Badge>
              </TableCell>
              <TableCell>{link.qty_from_batch} st</TableCell>
              <TableCell className="text-sm text-slate-500">
                {format(new Date(link.linked_at), 'PPp', { locale: sv })}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {link.linked_by}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}