import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Clock, TrendingDown } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function AlertList({ alerts = [], title = "Varningar", maxItems = 5 }) {
  const iconMap = {
    low_stock: TrendingDown,
    expiring: Clock,
    blocked_batch: Package,
    default: AlertTriangle
  };

  const severityColors = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  if (alerts.length === 0) {
    return (
      <Card className="p-6 border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-4">{title}</h3>
        <div className="text-center py-8 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Inga aktiva varningar</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Badge variant="outline" className="text-slate-500">
          {alerts.length} st
        </Badge>
      </div>
      <div className="space-y-3">
        {alerts.slice(0, maxItems).map((alert, index) => {
          const Icon = iconMap[alert.type] || iconMap.default;
          return (
            <div 
              key={index}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                severityColors[alert.severity] || severityColors.warning
              )}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{alert.title}</p>
                <p className="text-sm opacity-80 truncate">{alert.message}</p>
              </div>
            </div>
          );
        })}
      </div>
      {alerts.length > maxItems && (
        <p className="text-sm text-slate-500 mt-4 text-center">
          + {alerts.length - maxItems} till
        </p>
      )}
    </Card>
  );
}