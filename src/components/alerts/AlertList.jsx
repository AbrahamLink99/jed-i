import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, Clock, Package } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import AcknowledgeOrderDialog from './AcknowledgeOrderDialog';
import { evaluateInventoryAlerts } from './AlertEvaluator';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  info: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' }
};

const typeLabels = {
  LOW_STOCK: 'Lågt lager',
  BELOW_SAFETY: 'Under säkerhetslager',
  STOCKOUT_RISK: 'Risk för lagerbrist',
  MRP_PURCHASE_REQUIRED: 'Beställning krävs'
};

const statusLabels = {
  OPEN: 'Öppen',
  ORDERED_ACKNOWLEDGED: 'Beställd',
  CLOSED: 'Stängd'
};

export default function AlertList({ compact = false, productTypeFilter = 'all', stockFilter = 'all' }) {
  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['inventory_alerts', envFilter.environment],
    queryFn: () => base44.entities.InventoryAlert.filter(envFilter, '-created_date')
  });

  // Apply external filters
  const filteredAlertsAll = alerts.filter(a => {
    const matchType = productTypeFilter === 'all' || a.product_type === productTypeFilter;
    const avail = typeof a.current_available_qty === 'number' ? a.current_available_qty : (a.current_available_qty ? Number(a.current_available_qty) : 0);
    const matchStock = (
      stockFilter === 'all' ||
      (stockFilter === 'out' && avail <= 0) ||
      (stockFilter === 'below_safety' && a.type === 'BELOW_SAFETY') ||
      (stockFilter === 'low_stock' && a.type === 'LOW_STOCK')
    );
    return matchType && matchStock;
  });

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await evaluateInventoryAlerts();
      queryClient.invalidateQueries({ queryKey: ['inventory_alerts'] });
    } catch (error) {
      console.error('Error evaluating alerts:', error);
    } finally {
      setEvaluating(false);
    }
  };

  const openAlerts = filteredAlertsAll.filter(a => a.status === 'OPEN');
  const acknowledgedAlerts = filteredAlertsAll.filter(a => a.status === 'ORDERED_ACKNOWLEDGED');
  const closedAlerts = filteredAlertsAll.filter(a => a.status === 'CLOSED');

  if (compact) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <CardTitle>Lagernotiser</CardTitle>
            </div>
            <Badge variant="secondary">{openAlerts.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {openAlerts.length === 0 ? (
            <div className="text-center py-4 text-slate-500">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Inga aktiva notiser</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openAlerts.slice(0, 5).map(alert => {
                const config = severityConfig[alert.severity];
                return (
                  <div key={alert.id} className={cn("p-3 rounded-lg border", config.bg)}>
                    <div className="flex items-start gap-2">
                      <config.icon className={cn("w-4 h-4 mt-0.5", config.color)} />
                      <div className="flex-1 text-sm">
                        <div className="font-medium text-slate-900">
                          {alert.product_sku} - {alert.product_name}
                        </div>
                        <div className="text-slate-600 mt-1">{alert.message}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {openAlerts.length > 5 && (
                <p className="text-sm text-slate-500 text-center pt-2">
                  +{openAlerts.length - 5} fler notiser
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Lagernotiser</h2>
          <p className="text-slate-500 mt-1">Hantera lagervarningar och beställningar</p>
        </div>
        <Button onClick={handleEvaluate} disabled={evaluating}>
          {evaluating ? 'Uppdaterar...' : 'Uppdatera notiser'}
        </Button>
      </div>

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">
            Öppna ({openAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Beställda ({acknowledgedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Stängda ({closedAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <AlertTable 
            alerts={openAlerts} 
            onAcknowledge={setSelectedAlert}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="acknowledged">
          <AlertTable 
            alerts={acknowledgedAlerts}
            showOrderInfo
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="closed">
          <AlertTable 
            alerts={closedAlerts}
            showOrderInfo
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      {selectedAlert && (
        <AcknowledgeOrderDialog
          alert={selectedAlert}
          open={!!selectedAlert}
          onOpenChange={(open) => !open && setSelectedAlert(null)}
        />
      )}
    </div>
  );
}

function AlertTable({ alerts, onAcknowledge, showOrderInfo, isLoading }) {
  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-500">Laddar notiser...</p>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
        <p className="text-slate-500">Inga notiser</p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Typ</TableHead>
            <TableHead>Produkt</TableHead>
            <TableHead>Meddelande</TableHead>
            <TableHead className="text-right">Tillgängligt</TableHead>
            <TableHead className="text-right">Förslag</TableHead>
            <TableHead>Beställ senast</TableHead>
            {showOrderInfo && <TableHead>Beställning</TableHead>}
            {onAcknowledge && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map(alert => {
            const config = severityConfig[alert.severity];
            return (
              <TableRow key={alert.id}>
                <TableCell>
                  <Badge className={cn(config.badge, "font-normal text-xs")}>
                    {typeLabels[alert.type]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-slate-900">{alert.product_sku}</div>
                  <div className="text-sm text-slate-500">{alert.product_name}</div>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="flex items-start gap-2">
                    <config.icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                    <span className="text-sm text-slate-600">{alert.message}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {alert.current_available_qty || 0}
                </TableCell>
                <TableCell className="text-right">
                  {alert.suggested_order_qty && (
                    <span className="font-semibold text-slate-700">
                      {alert.suggested_order_qty}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {alert.order_by_date && (
                    <span className="text-sm text-slate-600">
                      {format(new Date(alert.order_by_date), 'd MMM yyyy', { locale: sv })}
                    </span>
                  )}
                </TableCell>
                {showOrderInfo && (
                  <TableCell>
                    {alert.order_reference && (
                      <div className="text-sm">
                        <div className="font-medium">{alert.order_reference}</div>
                        <div className="text-slate-500">{alert.ordered_qty} st</div>
                        {alert.ordered_at && (
                          <div className="text-xs text-slate-400">
                            {format(new Date(alert.ordered_at), 'd MMM', { locale: sv })}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                )}
                {onAcknowledge && (
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => onAcknowledge(alert)}
                    >
                      Markera som beställt
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}