import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, Clock, Package, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import AcknowledgeOrderDialog from './AcknowledgeOrderDialog';
import DeprioritizeDialog from './DeprioritizeDialog';
import ReceiveDialog from './ReceiveDialog';
import { evaluateInventoryAlerts } from './AlertEvaluator';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function AlertList({ compact = false, productTypeFilter = 'all', stockFilter = 'all', statusFilter = 'active' }) {
  const queryClient = useQueryClient();
  const envFilter = useEnvironmentFilter();
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [deprioritizeTarget, setDeprioritizeTarget] = useState(null);
  const [receiveTarget, setReceiveTarget] = useState(null);

  const updateAlertMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InventoryAlert.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_alerts'] });
      setDeprioritizeTarget(null);
      setReceiveTarget(null);
    },
  });

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['inventory_alerts', envFilter.environment],
    queryFn: () => base44.entities.InventoryAlert.filter({ ...envFilter, status: { $in: ['OPEN', 'ORDERED_ACKNOWLEDGED', 'DEPRIORITIZED', 'CLOSED'] } }, '-created_date')
  });

  // Apply external filters
  const baseFiltered = alerts.filter(a => {
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

  const allForTabs = baseFiltered; // status filtrering sker per flik lokalt

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

  const openAlerts = allForTabs.filter(a => a.status === 'OPEN');
  const acknowledgedAlerts = allForTabs.filter(a => a.status === 'ORDERED_ACKNOWLEDGED');
  const deprioritizedAlerts = allForTabs.filter(a => a.status === 'DEPRIORITIZED');
  const closedAlerts = allForTabs.filter(a => a.status === 'CLOSED');

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
      </div>

      {(() => { const defaultTab = statusFilter === 'deprioritized' ? 'deprioritized' : (statusFilter === 'closed' ? 'closed' : 'open'); return (
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="gap-2">
          <TabsTrigger value="open" className="px-5 py-2.5">
            Öppna ({openAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="px-5 py-2.5">
            Beställda ({acknowledgedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="closed" className="px-5 py-2.5">
            Stängda ({closedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="deprioritized" className="px-5 py-2.5">
            Ej prioriterade ({deprioritizedAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <AlertTable 
            alerts={openAlerts} 
            onAcknowledge={setSelectedAlert}
            isLoading={isLoading}
            onDeprioritize={(alert) => setDeprioritizeTarget(alert)}
          />
        </TabsContent>

        <TabsContent value="acknowledged">
          <AlertTable 
            alerts={acknowledgedAlerts}
            showOrderInfo
            isLoading={isLoading}
            onDeprioritize={(alert) => setDeprioritizeTarget(alert)}
            onReceive={(alert) => setReceiveTarget(alert)}
            onReopen={(alert) => updateAlertMutation.mutate({ id: alert.id, data: { status: 'OPEN', ordered_at: null, ordered_by: null, order_reference: null, notes: null } })}
          />
        </TabsContent>

        <TabsContent value="deprioritized">
          <AlertTable 
            alerts={deprioritizedAlerts}
            isLoading={isLoading}
            onReactivate={(alert) => updateAlertMutation.mutate({ id: alert.id, data: { status: 'OPEN', deprioritized_reason: null } })}
          />
        </TabsContent>

        <TabsContent value="closed">
          <AlertTable 
            alerts={closedAlerts}
            showOrderInfo
            isLoading={isLoading}
          />
        </TabsContent>
        </Tabs> ); })()}

      {selectedAlert && (
        <AcknowledgeOrderDialog
          alert={selectedAlert}
          open={!!selectedAlert}
          onOpenChange={(open) => !open && setSelectedAlert(null)}
        />
      )}

      {deprioritizeTarget && (
        <DeprioritizeDialog
          alert={deprioritizeTarget}
          open={!!deprioritizeTarget}
          onOpenChange={(open) => !open && setDeprioritizeTarget(null)}
          onConfirm={(reason) => updateAlertMutation.mutate({ id: deprioritizeTarget.id, data: { status: 'DEPRIORITIZED', deprioritized_reason: reason || '' } })}
        />
      )}

      {receiveTarget && (
        <ReceiveDialog
          alert={receiveTarget}
          open={!!receiveTarget}
          onOpenChange={(open) => !open && setReceiveTarget(null)}
          onConfirm={() => updateAlertMutation.mutate({ id: receiveTarget.id, data: { status: 'CLOSED', resolved_by: 'user', resolved_at: new Date().toISOString() } })}
        />
      )}
    </div>
  );
}

function AlertTable({ alerts, onAcknowledge, onDeprioritize, onReactivate, onReceive, onReopen, showOrderInfo, isLoading }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(new Set());
  const [bulkAckOpen, setBulkAckOpen] = useState(false);
  const [bulkDeprioOpen, setBulkDeprioOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [running, setRunning] = useState(false);

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const visibleIds = alerts.map(a => a.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

  const toggleRow = (id, checked) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked) setSelected(new Set(visibleIds));
    else setSelected(new Set());
  };

  const clearSelection = () => setSelected(new Set());

  const doBulkAcknowledge = async () => {
    setRunning(true);
    try {
      for (const id of Array.from(selected)) {
        await base44.entities.InventoryAlert.update(id, {
          status: 'ORDERED_ACKNOWLEDGED',
          notes: bulkText || undefined,
          ordered_at: new Date().toISOString()
        });
        await delay(200);
      }
      setBulkAckOpen(false);
      setBulkText('');
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['inventory_alerts'] });
    } finally {
      setRunning(false);
    }
  };

  const doBulkDeprioritize = async () => {
    setRunning(true);
    try {
      for (const id of Array.from(selected)) {
        await base44.entities.InventoryAlert.update(id, {
          status: 'DEPRIORITIZED',
          deprioritized_reason: bulkText || ''
        });
        await delay(200);
      }
      setBulkDeprioOpen(false);
      setBulkText('');
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['inventory_alerts'] });
    } finally {
      setRunning(false);
    }
  };

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
      {selected.size > 0 && (
        <div className="m-4 mb-0 p-3 bg-white border rounded-xl shadow flex items-center justify-between">
          <div className="text-sm">{selected.size} markerade</div>
          <div className="flex gap-2">
            <Button className="bg-slate-900 text-white" size="sm" onClick={() => { setBulkText(''); setBulkAckOpen(true); }} disabled={running}>
              Markera som beställd
            </Button>
            <Button className="bg-slate-900 text-white" size="sm" onClick={() => { setBulkText(''); setBulkDeprioOpen(true); }} disabled={running}>
              Markera som ej prioriterad
            </Button>
          </div>
        </div>
      )}
      <Table className="border-separate border-spacing-y-2 leading-[1.6]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44px]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                aria-label="Välj alla"
              />
            </TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Produkt</TableHead>
            <TableHead>Meddelande</TableHead>
            <TableHead className="text-right">Tillgängligt</TableHead>
            <TableHead className="text-right">Förslag</TableHead>
            <TableHead>Beställ senast</TableHead>
            {showOrderInfo && <TableHead>Beställning</TableHead>}
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map(alert => {
            const config = severityConfig[alert.severity];
            return (
              <TableRow key={alert.id} className={cn(alert.status === 'DEPRIORITIZED' && 'opacity-60')}>
                <TableCell className="px-4 py-5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={selected.has(alert.id)}
                    onChange={(e) => toggleRow(alert.id, e.target.checked)}
                    aria-label={`Välj ${alert.product_sku}`}
                  />
                </TableCell>
                <TableCell className="px-4 py-5">
                  <Badge className={cn(config.badge, "font-normal text-xs px-3 py-1.5 rounded-[20px]")}>
                    {typeLabels[alert.type]}
                  </Badge>
                  {alert.status === 'DEPRIORITIZED' && (
                    <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700 font-normal text-xs px-3 py-1.5 rounded-[20px]">Ej prioriterad</Badge>
                  )}
                </TableCell>
                <TableCell className="px-4 py-5">
                  <div className="font-medium text-slate-900 mb-1">{alert.product_sku}</div>
                  <div className="text-sm text-slate-500">{alert.product_name}</div>
                </TableCell>
                <TableCell className="max-w-md px-4 py-5 pr-6">
                  <div className="flex items-start gap-2">
                    <config.icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                    <div>
                      <span className="text-sm text-slate-600">{alert.message}</span>
                      {alert.status === 'DEPRIORITIZED' && alert.deprioritized_reason && (
                        <div className="text-xs italic text-slate-500 mt-1">Orsak: {alert.deprioritized_reason}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium px-4 py-5">
                  {alert.current_available_qty || 0}
                </TableCell>
                <TableCell className="text-right px-4 py-5">
                  {alert.suggested_order_qty && (
                    <span className="font-semibold text-slate-700">
                      {alert.suggested_order_qty}
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-5">
                  {alert.order_by_date && (
                    <span className="text-sm text-slate-600">
                      {format(new Date(alert.order_by_date), 'd MMM yyyy', { locale: sv })}
                    </span>
                  )}
                </TableCell>
                {showOrderInfo && (
                  <TableCell className="px-4 py-5">
                    {alert.order_reference && (
                      <div className="text-sm leading-[1.8] space-y-1 py-1">
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
                <TableCell className="px-4 py-5">
                  <div className="flex items-center justify-end gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="px-3 py-2">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="space-y-3 py-2">
                        {alert.status === 'OPEN' && onAcknowledge && (
                          <DropdownMenuItem className="px-3 py-2" onClick={() => onAcknowledge(alert)}>Markera som beställt</DropdownMenuItem>
                        )}
                        {alert.status === 'ORDERED_ACKNOWLEDGED' && (
                          <>
                            <DropdownMenuItem className="px-3 py-2" onClick={() => onReceive && onReceive(alert)}>Inleverans mottagen</DropdownMenuItem>
                            <DropdownMenuItem className="px-3 py-2" onClick={() => onReopen && onReopen(alert)}>Återöppna</DropdownMenuItem>
                          </>
                        )}
                        {alert.status !== 'DEPRIORITIZED' && alert.status !== 'CLOSED' && onDeprioritize && (
                          <DropdownMenuItem className="px-3 py-2" onClick={() => onDeprioritize(alert)}>Markera som ej prioriterad</DropdownMenuItem>
                        )}
                        {alert.status === 'DEPRIORITIZED' && onReactivate && (
                          <DropdownMenuItem className="px-3 py-2" onClick={() => onReactivate(alert)}>Återaktivera</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Bulk dialogs */}
      <Dialog open={bulkAckOpen} onOpenChange={(o) => { if (!o) setBulkAckOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Markera som beställd</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Beställningsinformation (valfritt)</Label>
            <Input value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="PO-nummer, leverantör, m.m." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAckOpen(false)}>Avbryt</Button>
            <Button className="bg-slate-900 text-white" onClick={doBulkAcknowledge} disabled={running}>Bekräfta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeprioOpen} onOpenChange={(o) => { if (!o) setBulkDeprioOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Markera som ej prioriterad</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Anledning (valfritt)</Label>
            <Input value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Varför skjuts detta upp?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeprioOpen(false)}>Avbryt</Button>
            <Button className="bg-slate-900 text-white" onClick={doBulkDeprioritize} disabled={running}>Bekräfta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}