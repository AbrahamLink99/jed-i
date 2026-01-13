import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Package } from 'lucide-react';

export default function RecentBatches({ batches = [], onBatchClick }) {
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

  if (batches.length === 0) {
    return (
      <Card className="p-6 border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-4">Senaste batcher</h3>
        <div className="text-center py-8 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Inga batcher registrerade</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-slate-200">
      <h3 className="font-semibold text-slate-900 mb-4">Senaste batcher</h3>
      <div className="space-y-3">
        {batches.map((batch) => (
          <div 
            key={batch.id}
            onClick={() => onBatchClick?.(batch)}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-slate-900">
                  {batch.batch_number}
                </span>
                <Badge className={statusColors[batch.status]} variant="secondary">
                  {statusLabels[batch.status]}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 truncate">
                {batch.product_name || batch.product_sku}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="font-semibold text-slate-900">
                {batch.current_quantity?.toLocaleString('sv-SE')} kg
              </p>
              <p className="text-xs text-slate-500">
                {batch.production_date && format(new Date(batch.production_date), 'd MMM', { locale: sv })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}