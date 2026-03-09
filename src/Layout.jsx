import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Factory, Boxes,
  Calculator, X, Sparkles, Send,
  Bell, Shield, ChefHat, Droplets, Zap, Users, CalendarDays
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { base44 } from '@/api/base44Client';
import { EnvironmentProvider } from '@/components/environment/EnvironmentContext';
import { useQuery } from '@tanstack/react-query';

// Nav sections per spec
const navSections = [
  {
    label: 'ÖVERSIKT',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
      { name: 'Notiser', icon: Bell, page: 'Alerts', alertBadge: true },
    ]
  },
  {
    label: 'LAGER & PRODUKTION',
    items: [
      { name: 'Artiklar', icon: Package, page: 'Products' },
      { name: 'Recept', icon: ChefHat, page: 'Recipes' },
      { name: 'Produktion', icon: Factory, page: 'Production' },
      { name: 'Tappning', icon: Droplets, page: 'Filling' },
      { name: 'Färdigvaror', icon: Package, page: 'FinishedGoods' },
      { name: 'Batcher', icon: Boxes, page: 'Batches' },
      { name: 'Planering', icon: Calculator, page: 'Planning' },
    ]
  }
];

const sectionLabelStyle = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.12em',
  color: 'rgba(237,229,212,0.30)',
  padding: '12px 12px 4px',
  textTransform: 'uppercase',
};

export default function Layout({ children, currentPageName }) {
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [user, setUser] = React.useState(null);

  // AI assistant state
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingActions, setPendingActions] = useState(null);
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
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  React.useEffect(() => {
    base44.entities.Product.list('-name', 1000).then(list => setProducts(Array.isArray(list) ? list : [])).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin';

  const { data: openAlerts = [] } = useQuery({
    queryKey: ['open-alerts-count'],
    queryFn: () => base44.entities.InventoryAlert.filter({ status: 'OPEN', environment: 'production' }),
    refetchInterval: 5 * 60 * 1000,
  });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');
    setThinking(true);
    try {
      const res = await base44.functions.invoke('aiProductionAssistant', { message: text });
      let payload = res?.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = { type: 'info', summary: String(payload), tables: [] }; }
      }
      if (!payload || typeof payload !== 'object') payload = { type: 'info', summary: 'Kunde inte tolka svaret.', tables: [] };
      const { type, summary, actions, tables } = payload;
      if (type === 'production' && Array.isArray(actions) && actions.length > 0) {
        const norm = actions.map(a => ({
          type: a.type, sku: a.sku,
          kg: a.kg ?? undefined, units: a.units ?? undefined,
          batch_no: a.batch_no || (a.type === 'mix_batch' ? genBatchNo('MB', a.sku) : genBatchNo('B', a.sku))
        }));
        setMessages(m => [...m, { role: 'assistant', content: summary || 'Kontrollera förslaget nedan.', type: 'production' }]);
        setPendingActions(norm);
      } else {
        setMessages(m => [...m, { role: 'assistant', content: summary || 'Här är informationen.', type: 'info', tables: Array.isArray(tables) ? tables : [] }]);
        setPendingActions(null);
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Tekniskt fel – försök igen.', type: 'info' }]);
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
    } finally {
      setSubmitting(false);
    }
  };

  const expanded = isSidebarHovered;

  return (
    <EnvironmentProvider>
      <div style={{ minHeight: '100vh', background: 'var(--beige-bg)' }}>

        {/* ── Sidebar ── */}
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          style={{
            position: 'fixed', inset: '0 auto 0 0', zIndex: 50,
            width: expanded ? 228 : 52,
            background: 'var(--navy)',
            transition: 'width 0.2s ease',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Logo */}
          <div style={{
            height: 64, display: 'flex', alignItems: 'center',
            padding: expanded ? '0 16px' : '0',
            justifyContent: expanded ? 'flex-start' : 'center',
            gap: 12,
            borderBottom: '1px solid rgba(237,229,212,0.10)',
            flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'var(--tan)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'Cormorant', serif", fontWeight: 600, fontSize: 14, color: 'var(--navy)', letterSpacing: '-0.01em' }}>JED</span>
            </div>
            {expanded && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 600, fontSize: 18, color: 'var(--text-on-navy)', lineHeight: 1.1 }}>Inventory</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 9, color: 'var(--text-on-navy-2)', letterSpacing: '0.14em', marginTop: 1 }}>MANAGEMENT</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {navSections.map(section => (
              <div key={section.label}>
                {expanded && (
                  <div style={sectionLabelStyle}>{section.label}</div>
                )}
                {section.items.map(item => {
                  const isActive = currentPageName === item.page;
                  const alertCount = item.alertBadge ? (openAlerts?.length || 0) : 0;
                  return (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      title={item.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: 38,
                        margin: '1px 6px',
                        borderRadius: 8,
                        paddingLeft: expanded ? 10 : 0,
                        paddingRight: expanded ? 10 : 0,
                        justifyContent: expanded ? 'flex-start' : 'center',
                        gap: 10,
                        borderLeft: isActive ? '3px solid var(--tan)' : '3px solid transparent',
                        background: isActive ? 'rgba(237,229,212,0.12)' : 'transparent',
                        textDecoration: 'none',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(237,229,212,0.06)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                        <item.icon
                          style={{
                            width: 16, height: 16,
                            color: isActive ? 'var(--text-on-navy)' : 'var(--text-on-navy-2)'
                          }}
                        />
                        {alertCount > 0 && (
                          <span style={{
                            position: 'absolute', top: -5, right: -7,
                            background: 'rgba(196,169,120,0.20)',
                            color: 'var(--tan)',
                            border: '1px solid rgba(196,169,120,0.50)',
                            fontSize: 8, minWidth: 15, height: 15,
                            borderRadius: 8, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', padding: '0 3px', fontWeight: 700,
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}>
                            {alertCount > 99 ? '99+' : alertCount}
                          </span>
                        )}
                      </div>
                      {expanded && (
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--text-on-navy)' : 'var(--text-on-navy-2)',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.name}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}

            {/* Admin */}
            {isAdmin && (
              <div>
                {expanded && <div style={sectionLabelStyle}>ADMIN</div>}
                <Link
                  to={createPageUrl('Admin')}
                  title="Admin"
                  style={{
                    display: 'flex', alignItems: 'center', height: 38,
                    margin: '1px 6px', borderRadius: 8,
                    paddingLeft: expanded ? 10 : 0,
                    paddingRight: expanded ? 10 : 0,
                    justifyContent: expanded ? 'flex-start' : 'center',
                    gap: 10,
                    borderLeft: currentPageName === 'Admin' ? '3px solid var(--tan)' : '3px solid transparent',
                    background: currentPageName === 'Admin' ? 'rgba(237,229,212,0.12)' : 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  <Shield style={{ width: 16, height: 16, color: currentPageName === 'Admin' ? 'var(--text-on-navy)' : 'var(--text-on-navy-2)', flexShrink: 0 }} />
                  {expanded && (
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: currentPageName === 'Admin' ? 600 : 400, color: currentPageName === 'Admin' ? 'var(--text-on-navy)' : 'var(--text-on-navy-2)' }}>Admin</span>
                  )}
                </Link>
              </div>
            )}
          </nav>

          {/* User footer */}
          <div style={{
            padding: '12px 8px',
            borderTop: '1px solid rgba(237,229,212,0.10)',
            flexShrink: 0,
          }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: expanded ? 'flex-start' : 'center' }}>
                <button
                  title="Logga ut"
                  onClick={() => base44.auth.logout()}
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--tan)', color: 'var(--navy)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700,
                    border: 'none', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </button>
                {expanded && (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: 'var(--text-on-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                      {user.full_name || user.email}
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'var(--text-on-navy-2)', textTransform: 'capitalize' }}>
                      {user.role || 'user'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <div style={{
          paddingLeft: expanded ? 228 : 52,
          transition: 'padding-left 0.2s ease',
          minHeight: '100vh',
        }}>
          <main style={{ background: 'var(--beige-bg)' }}>
            {children}
          </main>
        </div>

        {/* ── Floating AI button ── */}
        <button
          title="AI-assistent"
          onClick={() => setAssistantOpen(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 50,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--navy)', color: 'var(--text-on-navy)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(43,63,140,0.35)',
          }}
        >
          <Sparkles style={{ width: 22, height: 22 }} />
        </button>

        {/* ── AI Assistant Sheet ── */}
        <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
          <SheetContent side="right" className="w-[400px] p-0 flex flex-col" style={{ background: 'var(--creme)', borderLeft: '1px solid var(--ds-border)' }}>
            <SheetHeader className="p-4" style={{ borderBottom: '1px solid var(--ds-border)', background: 'var(--beige-card)' }}>
              <SheetTitle className="flex items-center justify-between" style={{ fontFamily: "'Cormorant', serif", fontSize: 20, color: 'var(--text-primary)' }}>
                <span>AI-assistent</span>
                <Button size="icon" variant="ghost" onClick={() => setAssistantOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.map((m, idx) => (
                <div key={idx} className="space-y-2">
                  <div style={{
                    maxWidth: '85%',
                    borderRadius: 12,
                    padding: '8px 12px',
                    marginLeft: m.role === 'user' ? 'auto' : undefined,
                    marginRight: m.role !== 'user' ? 'auto' : undefined,
                    background: m.role === 'user' ? 'var(--navy)' : 'white',
                    color: m.role === 'user' ? 'var(--text-on-navy)' : 'var(--text-primary)',
                    border: m.role !== 'user' ? '1px solid var(--ds-border)' : 'none',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                  }}>
                    {m.content}
                  </div>
                  {m.type === 'info' && Array.isArray(m.tables) && m.tables.length > 0 && (
                    <div style={{ background: 'white', border: '1px solid var(--ds-border)', borderRadius: 10, padding: 8, maxWidth: '85%' }}>
                      {m.tables.map((t, i) => (
                        <div key={i} className="mb-3 last:mb-0">
                          {t.title && <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t.title}</div>}
                          <div className="overflow-auto rounded-md">
                            <Table>
                              {t.columns && (
                                <TableHeader>
                                  <TableRow>
                                    {t.columns.map((c, ci) => <TableHead key={ci}>{String(c)}</TableHead>)}
                                  </TableRow>
                                </TableHeader>
                              )}
                              <TableBody>
                                {(t.rows || []).map((row, ri) => (
                                  <TableRow key={ri}>
                                    {row.map((cell, ci) => <TableCell key={ci}>{String(cell)}</TableCell>)}
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
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--text-tertiary)' }}>AI:n tänker...</div>
              )}
              {pendingActions && (
                <div style={{ border: '1px solid var(--ds-border)', borderRadius: 12, background: 'white' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--ds-border)', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13 }}>Föreslagna åtgärder</div>
                  <div style={{ padding: 12 }}>
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Typ</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Produkt</TableHead>
                            <TableHead>Antal</TableHead>
                            <TableHead>Batch</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingActions.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell style={{ fontSize: 12 }}>{a.type === 'mix_batch' ? 'Mix (kg)' : 'Färdig (st)'}</TableCell>
                              <TableCell style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{a.sku}</TableCell>
                              <TableCell style={{ fontSize: 12 }}>{productsBySku.get(a.sku)?.name || '-'}</TableCell>
                              <TableCell>
                                {a.type === 'mix_batch' ? (
                                  <Input type="number" step="0.001" value={a.kg ?? ''} onChange={e => setPendingActions(prev => prev.map((x,idx) => idx===i ? {...x, kg: e.target.value} : x))} className="h-8 w-20 text-right" />
                                ) : (
                                  <Input type="number" step="1" value={a.units ?? ''} onChange={e => setPendingActions(prev => prev.map((x,idx) => idx===i ? {...x, units: e.target.value} : x))} className="h-8 w-20 text-right" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Input value={a.batch_no} onChange={e => setPendingActions(prev => prev.map((x,idx) => idx===i ? {...x, batch_no: e.target.value} : x))} className="h-8" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex gap-2 justify-end mt-3">
                      <Button variant="outline" onClick={() => setPendingActions(null)}>Avbryt</Button>
                      <Button onClick={commitActions} disabled={submitting} style={{ background: 'var(--navy)', color: 'var(--text-on-navy)' }}>
                        {submitting ? '...' : 'Godkänn och registrera'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 12, borderTop: '1px solid var(--ds-border)', display: 'flex', gap: 8, background: 'var(--beige-card)' }}>
              <Input
                placeholder="Skriv t.ex. 'Körde 600 kg hårmask bas...'"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                style={{ flex: 1 }}
              />
              <Button onClick={sendMessage} style={{ background: 'var(--navy)', color: 'var(--text-on-navy)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send style={{ width: 14, height: 14 }} /> Skicka
              </Button>
            </div>
          </SheetContent>
        </Sheet>

      </div>
    </EnvironmentProvider>
  );
}