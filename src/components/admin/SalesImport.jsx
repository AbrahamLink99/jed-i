import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { evaluateInventoryAlerts } from "@/components/alerts/AlertEvaluator";
import { Upload, CheckCircle2, AlertTriangle, ShoppingCart } from "lucide-react";

function parseCSV(text, delimiter) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  const d = delimiter === ';' ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === d && !inQuotes) { current.push(field); field=''; }
    else if ((c === '\n' || c === '\r') && !inQuotes) { if (c==='\r' && text[i+1]==='\n') i++; current.push(field); rows.push(current); current=[]; field=''; }
    else { field += c; }
  }
  if (field.length > 0 || current.length > 0) { current.push(field); rows.push(current); }
  return rows.filter(r => r.length && r.some(v => (v || '').trim() !== ''));
}

function parseQty(raw) {
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  s = s.replace(/\s+/g, '');
  // remove thousands separators and normalize decimal to dot, then round
  s = s.replace(/\.(?=\d{3}(\D|$))/g, ''); // dot thousands
  s = s.replace(/,(?=\d{3}(\D|$))/g, '');   // comma thousands
  s = s.replace(/,/g, '.');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : Math.round(n);
}

export default function SalesImport() {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState('D2C'); // 'D2C' | 'B2B'
  const [delimiter, setDelimiter] = useState(',');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({ sku: '', qty: '' });
  const [preview, setPreview] = useState([]); // [{sku, qty, product, matched, include}]
  const [importing, setImporting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const headerIndex = useMemo(() => {
    const map = {};
    headers.forEach((h, i) => { map[String(h)] = i; });
    return map;
  }, [headers]);

  const getVal = (row, fieldKey) => {
    const col = mapping[fieldKey];
    if (!col) return '';
    const idx = headerIndex[col];
    if (idx === undefined) return '';
    return row[idx];
  };

  const uploadFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    const parsed = parseCSV(text, delimiter);
    if (!parsed.length) { toast.error('Filen verkar vara tom.'); return; }
    setHeaders(parsed[0]);
    setRows(parsed.slice(1));
    setStep(2);
  };

  const buildPreview = async () => {
    if (!mapping.sku || !mapping.qty) { toast.error('Välj kolumner för SKU och antal.'); return; }
    if (!rows.length) { toast.error('Ladda upp en CSV först.'); return; }

    // Build unique SKU list
    const csvSkus = rows.map(r => String(getVal(r, 'sku') || '').trim()).filter(Boolean);
    const uniqueSkus = Array.from(new Set(csvSkus));

    // Lookup products by SKU using $in
    let products = [];
    try {
      products = await base44.entities.Product.filter({ sku: { $in: uniqueSkus }, environment: 'production' });
    } catch (e) {
      // fallback: list all then filter in-memory (last resort)
      const all = await base44.entities.Product.list();
      products = all.filter(p => uniqueSkus.includes(p.sku));
    }
    const bySku = Object.fromEntries(products.map(p => [p.sku, p]));

    const built = rows.map((row, i) => {
      const sku = String(getVal(row, 'sku') || '').trim();
      const qtyRaw = getVal(row, 'qty');
      const qty = parseQty(qtyRaw);
      const product = sku ? bySku[sku] : undefined;
      const matched = Boolean(product);
      const include = matched && Number.isFinite(qty) && qty > 0; // default include only valid & matched
      return { idx: i + 1, sku, qty, product, product_name: product?.name || '-', matched, include };
    });

    setPreview(built);
    setStep(3);
  };

  const totals = useMemo(() => {
    const total = preview.length;
    const matched = preview.filter(r => r.matched).length;
    const unmatched = total - matched;
    const totalUnits = preview.filter(r => r.include && r.matched).reduce((s, r) => s + (r.qty || 0), 0);
    return { total, matched, unmatched, totalUnits };
  }, [preview]);

  const toggleInclude = (rowIdx, val) => {
    setPreview(prev => prev.map((r, i) => i === rowIdx ? { ...r, include: val } : r));
  };

  const doImport = async () => {
    const toImport = preview.filter(r => r.include && r.matched && Number.isFinite(r.qty) && r.qty > 0);
    if (!toImport.length) { toast.error('Inga rader valda för import.'); return; }
    setImporting(true);
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString('sv-SE');
      const notes = `Shopify ${source} veckorapport ${dateStr}`;

      // Create ledger entries in parallel (throttle not added for simplicity)
      await Promise.all(toImport.map((r) => {
        return base44.entities.InventoryLedger.create({
          environment: 'production',
          product_id: r.product.id,
          product_sku: r.product.sku,
          product_name: r.product.name,
          transaction_type: 'shipment',
          quantity: -Math.abs(r.qty || 0),
          reference_type: 'shopify_order',
          notes
        });
      }));

      // Evaluate alerts
      await evaluateInventoryAlerts();

      const skipped = preview.filter(r => !(r.include && r.matched));
      setReceipt({
        importedRows: toImport.length,
        totalUnits: toImport.reduce((s, r) => s + (r.qty || 0), 0),
        skippedSkus: Array.from(new Set(skipped.map(r => r.sku).filter(Boolean)))
      });
      toast.success('Försäljningsimport klar');
      setStep(4);
    } catch (e) {
      console.error(e);
      toast.error('Import misslyckades: ' + (e?.message || String(e)));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Försäljningsimport (Shopify CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
            <TabsList>
              <TabsTrigger value="1">1. Källa & Fil</TabsTrigger>
              <TabsTrigger value="2" disabled={!rows.length}>2. Mappning</TabsTrigger>
              <TabsTrigger value="3" disabled={!mapping.sku || !mapping.qty}>3. Preview</TabsTrigger>
              <TabsTrigger value="4" disabled={!receipt}>4. Kvitto</TabsTrigger>
            </TabsList>

            {/* Step 1 */}
            <TabsContent value="1" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Källa</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="D2C">D2C</SelectItem>
                      <SelectItem value="B2B">B2B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Avgränsare</Label>
                  <Select value={delimiter} onValueChange={setDelimiter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=";">Semikolon (;)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CSV-fil</Label>
                  <div className="flex items-center gap-3">
                    <Input type="file" accept=".csv,text/csv" onChange={(e) => uploadFile(e.target.files?.[0])} />
                    <Button variant="outline" onClick={() => { setHeaders([]); setRows([]); setMapping({ sku:'', qty:''}); setPreview([]); setReceipt(null); setFileName(''); setStep(1); }}>Rensa</Button>
                  </div>
                  {fileName && <p className="text-xs text-slate-500">Fil: {fileName}</p>}
                </div>
              </div>
            </TabsContent>

            {/* Step 2 */}
            <TabsContent value="2" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kolumn för SKU</Label>
                  <Select value={mapping.sku} onValueChange={(v) => setMapping(m => ({ ...m, sku: v }))}>
                    <SelectTrigger><SelectValue placeholder="Välj kolumn" /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h, i) => (<SelectItem key={i} value={h}>{h || '(tom)'}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kolumn för antal</Label>
                  <Select value={mapping.qty} onValueChange={(v) => setMapping(m => ({ ...m, qty: v }))}>
                    <SelectTrigger><SelectValue placeholder="Välj kolumn" /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h, i) => (<SelectItem key={i} value={h}>{h || '(tom)'}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Tillbaka</Button>
                <Button onClick={buildPreview} disabled={!mapping.sku || !mapping.qty}>Skapa preview</Button>
              </div>
            </TabsContent>

            {/* Step 3 */}
            <TabsContent value="3" className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="secondary">Totalt: {totals.total}</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700">Matchade: {totals.matched}</Badge>
                  <Badge className="bg-amber-100 text-amber-700">Omatchade: {totals.unmatched}</Badge>
                </div>
                <div className="text-sm text-slate-600">Totala enheter (valda): <span className="font-semibold">{totals.totalUnits}</span></div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ta med</TableHead>
                      <TableHead>Rad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead>Antal</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={!!r.include}
                            disabled={!r.matched}
                            onChange={(e) => toggleInclude(i, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{r.idx}</TableCell>
                        <TableCell className="font-mono">{r.sku}</TableCell>
                        <TableCell>{r.product_name}</TableCell>
                        <TableCell>{Number.isFinite(r.qty) ? r.qty : '-'}</TableCell>
                        <TableCell>
                          {r.matched ? (
                            <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Okänd SKU</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {preview.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500">Ingen data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Tillbaka</Button>
                <Button onClick={doImport} disabled={importing || !preview.some(r => r.include && r.matched)}>
                  {importing ? 'Importerar...' : 'Importera'}
                </Button>
              </div>
            </TabsContent>

            {/* Step 4 */}
            <TabsContent value="4" className="space-y-4">
              <Card className="border border-slate-200">
                <CardHeader>
                  <CardTitle>Kvitto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {receipt ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-emerald-50 text-emerald-700">
                          <div className="text-sm">Importerade rader</div>
                          <div className="text-2xl font-semibold">{receipt.importedRows}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-blue-50 text-blue-700">
                          <div className="text-sm">Totala enheter</div>
                          <div className="text-2xl font-semibold">{receipt.totalUnits}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-50 text-amber-700">
                          <div className="text-sm">Hoppade över</div>
                          <div className="text-2xl font-semibold">{receipt.skippedSkus.length}</div>
                        </div>
                      </div>
                      {receipt.skippedSkus.length > 0 && (
                        <div className="p-4 rounded-lg bg-slate-50">
                          <div className="text-sm font-medium text-slate-800 mb-1">SKU som hoppades över</div>
                          <div className="flex flex-wrap gap-2">
                            {receipt.skippedSkus.map((s, i) => (
                              <Badge key={i} variant="secondary" className="font-mono">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <Button onClick={() => { setStep(1); setHeaders([]); setRows([]); setMapping({ sku:'', qty:''}); setPreview([]); setReceipt(null); setFileName(''); }}>Ny import</Button>
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Ingen import har körts än.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}