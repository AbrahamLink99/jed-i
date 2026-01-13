import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Package } from 'lucide-react';
import { cn } from "@/lib/utils";
import BatchSearch from '@/components/batches/BatchSearch';
import BatchDetail from '@/components/batches/BatchDetail';
import { toast } from 'sonner';

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

export default function Batches() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState(null);

  const queryClient = useQueryClient();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list('-created_date')
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.InventoryLedger.list('-created_date', 500)
  });

  // Handle URL parameter for batch selection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get('batch');
    if (batchId && batches.length > 0) {
      const batch = batches.find(b => b.id === batchId);
      if (batch) {
        setSelectedBatch(batch);
      }
    }
  }, [batches]);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Batch.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Status uppdaterad');
    }
  });

  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      // Status filter
      if (statusFilter !== 'all' && batch.status !== statusFilter) return false;
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          batch.batch_number?.toLowerCase().includes(search) ||
          batch.product_sku?.toLowerCase().includes(search) ||
          batch.product_name?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [batches, statusFilter, searchTerm]);

  const handleStatusChange = (batchId, newStatus) => {
    updateMutation.mutate({ id: batchId, status: newStatus });
    if (selectedBatch?.id === batchId) {
      setSelectedBatch({ ...selectedBatch, status: newStatus });
    }
  };

  if (selectedBatch) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <BatchDetail
            batch={selectedBatch}
            ledgerEntries={ledger}
            onClose={() => setSelectedBatch(null)}
            onStatusChange={handleStatusChange}
            isUpdating={updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Batcher</h1>
          <p className="text-slate-500 mt-1">Sök och hantera produktionsbatcher</p>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <BatchSearch
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />
        </Card>

        {/* Batches Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batchnummer</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ursprunglig</TableHead>
                <TableHead className="text-right">Kvar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBatches.map((batch) => (
                <TableRow 
                  key={batch.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelectedBatch(batch)}
                >
                  <TableCell className="font-mono font-medium">
                    {batch.batch_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{batch.product_sku}</span>
                      {batch.product_name && (
                        <p className="text-sm text-slate-500">{batch.product_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {batch.production_date && format(new Date(batch.production_date), 'd MMM yyyy', { locale: sv })}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(statusColors[batch.status], "font-normal")}>
                      {statusLabels[batch.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-500">
                    {batch.produced_quantity?.toLocaleString('sv-SE')}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {batch.current_quantity?.toLocaleString('sv-SE')}
                  </TableCell>
                </TableRow>
              ))}
              {filteredBatches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Inga batcher hittades</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}