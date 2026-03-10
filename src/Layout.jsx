import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  LayoutDashboard, Package, Factory, Boxes,
  Calculator, X, Sparkles, Send,
  Bell, Shield, ChefHat, Droplets
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { base44 } from '@/api/base44Client';
import { EnvironmentProvider } from '@/components/environment/EnvironmentContext';
import { useQuery } from '@tanstack/react-query';

const NAV_ITEMS = [
  { name: 'Dashboard',    icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Notiser',      icon: Bell,             page: 'Alerts',       alertBadge: true },
  { name: 'Artiklar',     icon: Package,          page: 'Products' },
  { name: 'Recept',       icon: ChefHat,          page: 'Recipes' },
  { name: 'Produktion',   icon: Factory,          page: 'Production' },
  { name: 'Tappning',     icon: Droplets,         page: 'Filling' },
  { name: 'Färdigvaror',  icon: Package,          page: 'FinishedGoods' },
  { name: 'Batcher',      icon: Boxes,            page: 'Batches' },
  { name: 'Planering',    icon: Calculator,       page: 'Planning' },
];

const SIDEBAR_W = 62;
const TOPBAR_H  = 56;

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingActions, setPendingActions] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [products, setProducts] = useState([]);

  const productsBySku = useMemo(() => {
    const m = new Map(); products.forEach(p => m.set(p.sku, p)); return m;
  }, [products]);

  const productsById = useMemo(() => {
    const m = new Map(); products.forEach(p => m.set(p.id, p)); return m;
  }, [products]);

  const genBatchNo = (prefix, sku) => {
    const d = new Date();
    const ds = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('');
    return `${prefix}-${sku}-${ds}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  };

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  useEffect(() => { base44.entities.Product.list('-name', 1000).then(l => setProducts(Array.isArray(l) ? l : [])).catch(() => {}); }, []);

  const isAdmin = user?.role === 'admin';

  const { data: openAlerts = [] } = useQuery({
    queryKey: ['open-alerts-count'],
    queryFn: () => base44.entities.InventoryAlert.filter({ status: 'OPEN', environment: 'production' }),
    refetchInterval: 5 * 60 * 1000,
  });
  const alertCount = openAlerts?.length || 0;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');
    setThinking(true);
    try {
      const res = await base44.functions.invoke('aiProductionAssistant', { message: text });
      let payload = res?.data;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = { type: 'info', summary: String(payload) }; } }
      if (!payload || typeof payload !== 'object') payload = { type: 'info', summary: 'Kunde inte tolka svaret.' };
      const { type, summary, actions, tables } = payload;
      if (type === 'production' && Array.isArray(actions) && actions.length > 0) {
        const norm = actions.map(a => ({ type: a.type, sku: a.sku, kg: a.kg, units: a.units, batch_no: a.batch_no || (a.type === 'mix_batch' ? genBatchNo('MB', a.sku) : genBatchNo('B', a.sku)) }));
        setMessages(m => [...m, { role: 'assistant', content: summary || 'Kontrollera förslaget nedan.', type: 'production' }]);
        setPendingActions(norm);
      } else {
        setMessages(m => [...m, { role: 'assistant', content: summary || 'Här är informationen.', type: 'info', tables: Array.isArray(tables) ? tables : [] }]);
        setPendingActions(null);
      }
    } catch { setMessages(m => [...m, { role: 'assistant', content: 'Tekniskt fel – försök igen.', type: 'info' }]); }
    finally { setThinking(false); }
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
          await base44.entities.MixBatch.create({ environment: 'production', mix_sku: a.sku, batch_no: a.batch_no, produced_kg: kg, remaining_kg: kg, status: 'available', produced_at: new Date().toISOString(), notes: 'Via AI-assistent' });
          await base44.entities.InventoryLedger.create({ environment: 'production', product_id: prod.id, product_sku: prod.sku, product_name: prod.name, transaction_type: 'production', quantity: kg, reference_type: 'production_run', notes: `MixBatch ${a.batch_no} via AI` });
          const bom = await base44.entities.BOMItem.filter({ finished_product_id: prod.id });
          for (const line of (bom || [])) {
            const comp = productsById.get(line.component_id);
            const qty = -((Number(line.quantity_per_unit) || 0) * kg);
            if (!comp || !qty) continue;
            await base44.entities.InventoryLedger.create({ environment: 'production', product_id: comp.id, product_sku: comp.sku, product_name: comp.name, transaction_type: 'backflush', quantity: qty, reference_type: 'production_run', notes: `Backflush ${a.batch_no} via AI` });
          }
        } else if (a.type === 'finished_batch') {
          await base44.entities.Batch.create({ environment: 'production', batch_number: a.batch_no, product_id: prod.id, product_sku: prod.sku, product_name: prod.name, produced_quantity: Number(a.units) || 0, current_quantity: Number(a.units) || 0, status: 'available', production_date: new Date().toISOString().slice(0,10) });
          await base44.entities.InventoryLedger.create({ environment: 'production', product_id: prod.id, product_sku: prod.sku, product_name: prod.name, transaction_type: 'production', quantity: Number(a.units) || 0, reference_type: 'production_run', notes: `Batch ${a.batch_no} via AI` });
        }
      }
      setMessages(m => [...m, { role: 'assistant', content: 'Klart! Produktionen har registrerats.' }]);
      setPendingActions(null);
    } finally { setSubmitting(false); }
  };

  /* ─── Page title helpers ─── */
  const PAGE_TITLES = {
    Dashboard: { title: 'Dashboard', sub: 'Aktuell status & nyckeltal' },
    Alerts: { title: 'Notiser', sub: 'Lagervarningar & åtgärder' },
    Products: { title: 'Artiklar', sub: 'Produkter, råvaror & förpackning' },
    Recipes: { title: 'Recept', sub: 'Förpackningsrecept & BOM' },
    Production: { title: 'Produktion', sub: 'Mix-batcher & tillverkning' },
    Filling: { title: 'Tappning', sub: 'Fyll & registrera färdigvaror' },
    FinishedGoods: { title: 'Färdigvaror', sub: 'Lagersaldo färdiga produkter' },
    Batches: { title: 'Batcher', sub: 'Batchspårning & historik' },
    Planning: { title: 'Planering', sub: 'MRP & planeringsscenarier' },
    Admin: { title: 'Admin', sub: 'Systemkonfiguration & användare' },
  };
  const pt = PAGE_TITLES[currentPageName] || { title: currentPageName, sub: '' };

  return (
    <EnvironmentProvider>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          position: 'fixed', inset: '0 auto 0 0', zIndex: 50,
          width: SIDEBAR_W,
          background: 'var(--sidebar-bg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* Logo mark */}
          <div style={{
            height: TOPBAR_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', borderBottom: '1px solid rgba(245,240,232,0.07)',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 12, color: '#fff', letterSpacing: '-0.03em' }}>JED</span>
            </div>
          </div>

          {/* Nav icons */}
          <nav style={{ flex: 1, width: '100%', padding: '8px 0', overflowY: 'auto' }}>
            {NAV_ITEMS.map(item => {
              const isActive = currentPageName === item.page;
              const cnt = item.alertBadge ? alertCount : 0;
              return (
                <Link key={item.page} to={createPageUrl(item.page)} title={item.name}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, textDecoration: 'none' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? 'rgba(245,240,232,0.95)' : 'transparent',
                    position: 'relative',
                    transition: 'background 0.15s',
                  }}>
                    <item.icon style={{
                      width: 17, height: 17,
                      color: isActive ? 'var(--sidebar-bg)' : 'var(--sidebar-text)',
                    }} />
                    {cnt > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 8, minWidth: 14, height: 14,
                        borderRadius: 7, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: '0 3px', fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>{cnt > 99 ? '99+' : cnt}</span>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* Admin */}
            {isAdmin && (
              <Link to={createPageUrl('Admin')} title="Admin"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, textDecoration: 'none' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: currentPageName === 'Admin' ? 'rgba(245,240,232,0.95)' : 'transparent',
                }}>
                  <Shield style={{ width: 17, height: 17, color: currentPageName === 'Admin' ? 'var(--sidebar-bg)' : 'var(--sidebar-text)' }} />
                </div>
              </Link>
            )}
          </nav>

          {/* Avatar footer */}
          <div style={{ padding: '12px 0', borderTop: '1px solid rgba(245,240,232,0.07)', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <button
              title={`Logga ut (${user?.full_name || user?.email || ''})`}
              onClick={() => base44.auth.logout()}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#0D1A0F',
                color: 'var(--text-on-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700,
                border: '1.5px solid rgba(245,240,232,0.14)', cursor: 'pointer',
              }}>
              {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </button>
          </div>
        </aside>

        {/* ── Topbar ── */}
        <div style={{
          position: 'fixed', top: 0, left: SIDEBAR_W, right: 0, height: TOPBAR_H, zIndex: 40,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 24px',
        }}>
          {/* Page heading */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', margin: 0, lineHeight: 1.1, color: 'var(--text-primary)', fontFamily: "'DM Sans', sans-serif" }}>
              {pt.title}
              {pt.sub && (
                <span style={{ fontFamily: "'Cormorant', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 15, color: 'var(--text-tertiary)', marginLeft: 12, letterSpacing: '0.01em' }}>
                  {pt.sub}
                </span>
              )}
            </h1>
          </div>

          {/* Center: Alert pill */}
          {alertCount > 0 && (
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              <Link to={createPageUrl('Alerts')} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--accent-muted)',
                  border: '1px solid rgba(196,98,45,0.22)',
                  borderRadius: 50, padding: '5px 14px',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  color: 'var(--accent)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                  {alertCount} {alertCount === 1 ? 'aktiv notis' : 'aktiva notiser'}
                </div>
              </Link>
            </div>
          )}

          {/* Right: AI CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setAssistantOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--text-primary)', color: 'var(--text-on-dark)',
                border: 'none', borderRadius: 50, padding: '8px 16px',
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}>
              <Sparkles style={{ width: 14, height: 14 }} />
              AI-assistent
            </button>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ paddingLeft: SIDEBAR_W, paddingTop: TOPBAR_H, minHeight: '100vh', background: 'var(--bg)' }}>
          <main>{children}</main>
        </div>

        {/* ── AI Assistant Sheet ── */}
        <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
          <SheetContent side="right" className="w-[420px] p-0 flex flex-col" style={{ background: 'var(--panel)', borderLeft: '1px solid var(--border)' }}>
            <SheetHeader className="p-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel-hover)' }}>
              <SheetTitle className="flex items-center justify-between" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                <span>AI-assistent</span>
                <Button size="icon" variant="ghost" onClick={() => setAssistantOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p style={{ fontFamily: "'Cormorant', serif", fontStyle: 'italic', fontSize: 16, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 40 }}>
                  Beskriv vad du körde, så registrerar jag det åt dig.
                </p>
              )}
              {messages.map((m, idx) => (
                <div key={idx} className="space-y-2">
                  <div style={{
                    maxWidth: '85%',
                    borderRadius: 12, padding: '8px 12px',
                    marginLeft: m.role === 'user' ? 'auto' : undefined,
                    background: m.role === 'user' ? 'var(--text-primary)' : 'white',
                    color: m.role === 'user' ? 'var(--text-on-dark)' : 'var(--text-primary)',
                    border: m.role !== 'user' ? '1px solid var(--border)' : 'none',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                  }}>
                    {m.content}
                  </div>
                  {m.type === 'info' && Array.isArray(m.tables) && m.tables.length > 0 && (
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 8, maxWidth: '85%' }}>
                      {m.tables.map((t, i) => (
                        <div key={i} className="mb-3 last:mb-0">
                          {t.title && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{t.title}</div>}
                          <div className="overflow-auto rounded-md">
                            <Table>
                              {t.columns && <TableHeader><TableRow>{t.columns.map((c, ci) => <TableHead key={ci}>{String(c)}</TableHead>)}</TableRow></TableHeader>}
                              <TableBody>{(t.rows || []).map((row, ri) => <TableRow key={ri}>{row.map((cell, ci) => <TableCell key={ci}>{String(cell)}</TableCell>)}</TableRow>)}</TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {thinking && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--text-tertiary)' }}>Tänker...</div>}
              {pendingActions && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'white' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13 }}>Föreslagna åtgärder</div>
                  <div style={{ padding: 12 }}>
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Typ</TableHead><TableHead>SKU</TableHead><TableHead>Produkt</TableHead><TableHead>Antal</TableHead><TableHead>Batch</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {pendingActions.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell style={{ fontSize: 12 }}>{a.type === 'mix_batch' ? 'Mix (kg)' : 'Färdig (st)'}</TableCell>
                              <TableCell style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{a.sku}</TableCell>
                              <TableCell style={{ fontSize: 12 }}>{productsBySku.get(a.sku)?.name || '-'}</TableCell>
                              <TableCell>
                                {a.type === 'mix_batch'
                                  ? <Input type="number" step="0.001" value={a.kg ?? ''} onChange={e => setPendingActions(prev => prev.map((x,idx) => idx===i ? {...x, kg: e.target.value} : x))} className="h-8 w-20 text-right" />
                                  : <Input type="number" step="1" value={a.units ?? ''} onChange={e => setPendingActions(prev => prev.map((x,idx) => idx===i ? {...x, units: e.target.value} : x))} className="h-8 w-20 text-right" />}
                              </TableCell>
                              <TableCell><Input value={a.batch_no} onChange={e => setPendingActions(prev => prev.map((x,idx) => idx===i ? {...x, batch_no: e.target.value} : x))} className="h-8" /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex gap-2 justify-end mt-3">
                      <Button variant="outline" onClick={() => setPendingActions(null)}>Avbryt</Button>
                      <Button onClick={commitActions} disabled={submitting} style={{ background: 'var(--text-primary)', color: 'var(--text-on-dark)' }}>
                        {submitting ? '...' : 'Godkänn och registrera'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--panel-hover)' }}>
              <Input
                placeholder="Beskriv körningen..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                style={{ flex: 1 }}
              />
              <Button onClick={sendMessage} style={{ background: 'var(--text-primary)', color: 'var(--text-on-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send style={{ width: 14, height: 14 }} /> Skicka
              </Button>
            </div>
          </SheetContent>
        </Sheet>

      </div>
    </EnvironmentProvider>
  );
}