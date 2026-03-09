import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Factory, Boxes,
  Calculator, Menu, X, Sparkles, Send,
  ChevronRight, Bell, Shield, LogOut, ChefHat, Droplets } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { base44 } from '@/api/base44Client';
import { EnvironmentProvider } from '@/components/environment/EnvironmentContext';
import { useQuery } from '@tanstack/react-query';




const navigation = [
{ name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
{ name: 'Notiser', icon: Bell, page: 'Alerts' },
{ name: 'Artiklar', icon: Package, page: 'Products' },
{ name: 'Recept', icon: ChefHat, page: 'Recipes' },
{ name: 'Produktion', icon: Factory, page: 'Production' },
{ name: 'Tappning', icon: Droplets, page: 'Filling' },
{ name: 'Färdigvaror', icon: Package, page: 'FinishedGoods' },
{ name: 'Batcher', icon: Boxes, page: 'Batches' },
{ name: 'Planering', icon: Calculator, page: 'Planning' }];


export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [user, setUser] = useState(null);

  // AI assistant state
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role: 'user'|'assistant', content: string, type?: 'info'|'production', tables?: any[]}
  const [input, setInput] = useState("");
  const [pendingActions, setPendingActions] = useState(null); // [{type, sku, kg|units, batch_no}]
  const [submitting, setSubmitting] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [products, setProducts] = useState([]);

  const productsBySku = React.useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.sku, p);
    return m;
  }, [products]);

  const productsById = React.useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const genBatchNo = (prefix, sku) => {
    const d = new Date();
    const ds = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('');
    const rand = Math.random().toString(36).slice(2,6).toUpperCase();
    return `${prefix}-${sku}-${ds}-${rand}`;
  };


  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  // Load products once (used for name lookup and committing actions)
  React.useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Product.list('-name', 1000);
        setProducts(Array.isArray(list) ? list : []);
      } catch (e) { console.warn('Failed to load products', e); }
    })();
  }, []);

  const navItems = React.useMemo(
    () => (user?.role === 'admin' ? [...navigation, { name: 'Admin', icon: Shield, page: 'Admin' }] : navigation),
    [user]
  );

  const { data: openAlerts = [] } = useQuery({
    queryKey: ['open-alerts-count'],
    queryFn: () => base44.entities.InventoryAlert.filter({ status: 'OPEN', environment: 'production' }),
    refetchInterval: 5 * 60 * 1000,
  });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setThinking(true);

    try {
      const res = await base44.functions.invoke('aiProductionAssistant', { message: text });
      console.debug('AI-assistenten – rått svar:', res?.data || res);

      // Robust hantering: backend returnerar vanligtvis ett objekt, men hantera även sträng
      let payload = res?.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = { type: 'info', summary: String(payload), tables: [] }; }
      }
      if (!payload || typeof payload !== 'object') {
        payload = { type: 'info', summary: 'Kunde inte tolka svaret från AI:n.', tables: [] };
      }

      const { type, summary, actions, tables } = payload;

      if (type === 'production' && Array.isArray(actions) && actions.length > 0) {
        const norm = actions.map(a => ({
          type: a.type,
          sku: a.sku,
          kg: a.kg ?? undefined,
          units: a.units ?? undefined,
          batch_no: a.batch_no || (a.type === 'mix_batch' ? genBatchNo('MB', a.sku) : genBatchNo('B', a.sku))
        }));
        setMessages((m) => [...m, { role: 'assistant', content: summary || 'Jag har tolkat din text. Kontrollera förslaget nedan.', type: 'production' }]);
        setPendingActions(norm);
      } else {
        // Info-svar: rendera sammanfattning + tabeller
        setMessages((m) => [...m, {
          role: 'assistant',
          content: summary || 'Här är informationen du efterfrågade.',
          type: 'info',
          tables: Array.isArray(tables) ? tables : []
        }]);
        setPendingActions(null);
      }
    } catch (e) {
      console.error('AI-assistenten – fel:', e);
      setMessages((m) => [...m, { role: 'assistant', content: 'Kunde inte tolka svaret från AI:n (tekniskt fel). Försök igen om en stund.', type: 'info' }]);
      setPendingActions(null);
    } finally {
      setThinking(false);
    }
  };

  const commitActions = async () => {
    if (!pendingActions || submitting) return;
    setSubmitting(true);
    try {
      for (const a of pendingActions) {
        const prod = productsBySku.get(a.sku);
        if (!prod) continue;
        if (a.type === 'mix_batch') {
          const kg = Number(a.kg) || 0;
          // Create MixBatch and production ledger (kg)
          await base44.entities.MixBatch.create({
            environment: 'production',
            mix_sku: a.sku,
            batch_no: a.batch_no,
            produced_kg: kg,
            remaining_kg: kg,
            status: 'available',
            produced_at: new Date().toISOString(),
            notes: 'Registrerad via AI-assistent'
          });
          await base44.entities.InventoryLedger.create({
            environment: 'production',
            product_id: prod.id,
            product_sku: prod.sku,
            product_name: prod.name,
            transaction_type: 'production',
            quantity: kg,
            reference_type: 'production_run',
            notes: `MixBatch ${a.batch_no} via AI-assistent`
          });
          // Backflush components based on BOM
          const bom = await base44.entities.BOMItem.filter({ finished_product_id: prod.id });
          for (const line of (bom || [])) {
            const comp = productsById.get(line.component_id);
            const qty = -((Number(line.quantity_per_unit) || 0) * kg);
            if (!comp || !qty) continue;
            await base44.entities.InventoryLedger.create({
              environment: 'production',
              product_id: comp.id,
              product_sku: comp.sku,
              product_name: comp.name,
              transaction_type: 'backflush',
              quantity: qty,
              reference_type: 'production_run',
              notes: `Backflush för MixBatch ${a.batch_no} via AI-assistent`
            });
          }
        } else if (a.type === 'finished_batch') {
          // Create generic Batch and production ledger (units)
          await base44.entities.Batch.create({
            environment: 'production',
            batch_number: a.batch_no,
            product_id: prod.id,
            product_sku: prod.sku,
            product_name: prod.name,
            produced_quantity: Number(a.units) || 0,
            current_quantity: Number(a.units) || 0,
            status: 'available',
            production_date: new Date().toISOString().slice(0,10)
          });
          await base44.entities.InventoryLedger.create({
            environment: 'production',
            product_id: prod.id,
            product_sku: prod.sku,
            product_name: prod.name,
            transaction_type: 'production',
            quantity: Number(a.units) || 0,
            reference_type: 'production_run',
            notes: `Batch ${a.batch_no} via AI-assistent`
          });
        }
      }
      setMessages((m) => [...m, { role: 'assistant', content: 'Klart! Produktionen har registrerats.' }]);
      setPendingActions(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EnvironmentProvider>
      <div className="group min-h-screen">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={cn(
          "group fixed inset-y-0 left-0 z-50 w-[52px] bg-white border-r border-black/[0.06] transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-in-out",
          isSidebarHovered ? "lg:w-[200px]" : "lg:w-[52px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-center h-16 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-extrabold text-sm leading-none">L</div>
        </div>

        <nav className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                title={item.name}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center h-10 w-full mx-0 rounded-full transition-all",
                  isSidebarHovered ? "px-3 justify-start" : "px-0 justify-center",
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                               {isActive && (
                                 <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-slate-900" aria-hidden />
                               )}
                               <div className="relative">
                  <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-700")} />
                  {item.page === 'Alerts' && (openAlerts?.length || 0) > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: '#E53E3E',
                        color: 'white',
                        fontSize: 10,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        lineHeight: '18px'
                      }}
                    >
                      {openAlerts.length > 99 ? '99+' : openAlerts.length}
                    </span>
                  )}
                </div>
                <span className={cn(
                   "ml-3 text-sm font-medium transition-all duration-200",
                   isSidebarHovered ? "inline opacity-100 translate-x-0" : "hidden",
                   isActive ? "text-white" : "text-slate-700"
                 )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 bg-white">
          {user && (
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-slate-100"
                title="Logga ut"
                onClick={() => base44.auth.logout()}
              >
                <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={cn(isSidebarHovered ? "lg:pl-[200px]" : "lg:pl-[52px]", "transition-[padding] duration-200 ease-in-out")}>

        {/* Page content */}
        <main>

          {children}
        </main>
      </div>

      {/* Floating AI Assistant Button */}
      <button
        title="AI-assistent"
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-black text-white shadow-lg flex items-center justify-center hover:opacity-90 focus:outline-none"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Assistant Panel */}
      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent side="right" className="w-[400px] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center justify-between">
              <span>AI-assistent</span>
              <Button size="icon" variant="ghost" onClick={() => setAssistantOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </SheetTitle>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((m, idx) => (
              <div key={idx} className="space-y-2">
                <div className={cn('max-w-[85%] rounded-2xl px-3 py-2', m.role === 'user' ? 'ml-auto bg-slate-900 text-white' : 'mr-auto bg-white border')}>
                  {m.content}
                </div>
                {m.type === 'info' && Array.isArray(m.tables) && m.tables.length > 0 && (
                  <div className="mr-auto bg-white rounded-lg border shadow-sm p-2 max-w-[85%]">
                    {m.tables.map((t, i) => (
                      <div key={i} className="mb-3 last:mb-0">
                        {t.title && <div className="text-sm font-medium mb-2">{t.title}</div>}
                        <div className="overflow-auto rounded-md">
                          <Table>
                            {t.columns && (
                              <TableHeader className="bg-slate-100">
                                <TableRow>
                                  {t.columns.map((c, ci) => (
                                    <TableHead
                                      key={ci}
                                      className="px-3 py-2 text-xs font-semibold text-slate-700 uppercase"
                                    >
                                      {String(c)}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                            )}
                            <TableBody>
                              {(t.rows || []).map((row, ri) => (
                                <TableRow key={ri} className="odd:bg-white even:bg-slate-50">
                                  {row.map((cell, ci) => (
                                    <TableCell key={ci} className="px-3 py-2 text-sm">
                                      {String(cell)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {thinking && (
              <div className="mr-auto max-w-[70%] text-sm text-slate-600">AI:n tänker...</div>
            )}

            {pendingActions && (
              <div className="border rounded-xl bg-white">
                <div className="p-3 border-b font-medium">Föreslagna åtgärder</div>
                <div className="p-3">
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Typ</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Produkt</TableHead>
                          <TableHead className="text-right">Antal</TableHead>
                          <TableHead>Batch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingActions.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{a.type === 'mix_batch' ? 'Mix (kg)' : 'Färdig (st)'}</TableCell>
                            <TableCell className="font-mono text-xs">{a.sku}</TableCell>
                            <TableCell className="text-xs">{productsBySku.get(a.sku)?.name || '-'}</TableCell>
                            <TableCell>
                              {a.type === 'mix_batch' ? (
                                <Input type="number" step="0.001" value={a.kg ?? ''} onChange={(e)=>{
                                  const v = e.target.value; setPendingActions(prev => prev.map((x,idx)=> idx===i? {...x, kg: v }: x));
                                }} className="h-8 w-24 text-right" />
                              ) : (
                                <Input type="number" step="1" value={a.units ?? ''} onChange={(e)=>{
                                  const v = e.target.value; setPendingActions(prev => prev.map((x,idx)=> idx===i? {...x, units: v }: x));
                                }} className="h-8 w-24 text-right" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Input value={a.batch_no} onChange={(e)=>{
                                const v = e.target.value; setPendingActions(prev => prev.map((x,idx)=> idx===i? {...x, batch_no: v }: x));
                              }} className="h-8" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-2 justify-end mt-3">
                    <Button variant="outline" onClick={()=> setPendingActions(null)}>Avbryt</Button>
                    <Button onClick={commitActions} disabled={submitting} className="gap-2">
                      {submitting && <span className="animate-pulse">...</span>} Godkänn och registrera
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="p-3 border-t flex items-center gap-2">
            <Input
              placeholder="Skriv t.ex. 'Körde 600 kg hårmask bas...'"
              value={input}
              onChange={(e)=> setInput(e.target.value)}
              onKeyDown={(e)=> { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <Button onClick={sendMessage} className="gap-2">
              <Send className="w-4 h-4" /> Skicka
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      </div>
    </EnvironmentProvider>
  );
}