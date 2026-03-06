import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, CheckCircle2, AlertTriangle, Download } from "lucide-react";

function parseCSV(text) {
  // Simple CSV parser supporting comma or semicolon separators and quoted values
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const guessSep = (l) => (l.indexOf(";") > -1 && l.indexOf(",") === -1) ? ";" : ",";
  const sep = guessSep(lines[0]);
  const parseLine = (line) => {
    const out = [];
    let cur = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === sep && !inQuotes) {
        out.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headerArr = parseLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const vals = parseLine(l).map(v => v.trim());
    const obj = {};
    headerArr.forEach((h, idx) => obj[h || `col_${idx+1}`] = vals[idx]);
    return obj;
  });
  return { headers: headerArr, rows };
}

export default function MeticsImport() {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState(null); // {name, url, type}
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);

  const [ingredientCol, setIngredientCol] = useState("");
  const [qtyCol, setQtyCol] = useState("");
  const [qtyUnit, setQtyUnit] = useState("kg"); // kg | g
  const [namesNotSku, setNamesNotSku] = useState(false);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  const [nameToSkuMap, setNameToSkuMap] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // {created, updated, productsCount}

  useEffect(() => {
    // Ladda alla produkter för mapping och val
    (async () => {
      const list = await base44.entities.Product.list('-name', 1000);
      setProducts(Array.isArray(list) ? list : []);
    })();
  }, []);

  const productsBySku = useMemo(() => {
    const map = new Map();
    for (const p of products) map.set(p.sku, p);
    return map;
  }, [products]);

  const finishedAndMixProducts = useMemo(() => {
    return products.filter(p => p.type === 'finished_good' || p.type === 'raw_material');
  }, [products]);

  const uniqueIngredientNames = useMemo(() => {
    if (!namesNotSku || !ingredientCol) return [];
    const s = new Set();
    for (const r of rawRows) {
      const v = (r[ingredientCol] ?? "").toString().trim();
      if (v) s.add(v);
    }
    return Array.from(s);
  }, [namesNotSku, ingredientCol, rawRows]);

  const previewRows = useMemo(() => {
    if (!ingredientCol || !qtyCol) return [];
    return rawRows.map(r => {
      const rawIng = (r[ingredientCol] ?? "").toString().trim();
      const qtyRaw = Number((r[qtyCol] ?? "").toString().replace(",", "."));
      const qty = isFinite(qtyRaw) ? qtyRaw : NaN;
      const qtyInKg = !Number.isNaN(qty) ? (qtyUnit === 'g' ? qty / 1000 : qty) : NaN;
      const sku = namesNotSku ? (nameToSkuMap[rawIng] || "") : rawIng;
      const prod = sku ? productsBySku.get(sku) : undefined;
      return {
        rawIngredient: rawIng,
        sku,
        productName: prod?.name || "",
        qtyKg: qtyInKg,
        found: Boolean(prod),
      };
    });
  }, [ingredientCol, qtyCol, qtyUnit, namesNotSku, nameToSkuMap, rawRows, productsBySku]);

  const stats = useMemo(() => {
    const total = previewRows.length;
    const matched = previewRows.filter(r => r.found && !Number.isNaN(r.qtyKg)).length;
    const missing = previewRows.filter(r => !r.found).length;
    return { total, matched, missing };
  }, [previewRows]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const lower = file.name.toLowerCase();
      let headers = [];
      let rows = [];

      if (lower.endsWith('.csv')) {
        const resp = await fetch(file_url);
        const text = await resp.text();
        const parsed = parseCSV(text);
        headers = parsed.headers;
        rows = parsed.rows;
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        // Excel-fallback: om parsing inte är tillgänglig, be användaren använda CSV
        try {
          const schema = { type: 'object', additionalProperties: true };
          const res = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: schema });
          if (res.status === 'success') {
            const out = Array.isArray(res.output) ? res.output : (Array.isArray(res.output?.rows) ? res.output.rows : []);
            rows = out;
            if (out.length > 0) headers = Object.keys(out[0]);
          } else {
            alert('Excel-stöd är inte tillgängligt just nu. Konvertera filen till CSV och försök igen.');
            setUploading(false);
            return;
          }
        } catch (e) {
          alert('Excel-stöd är inte tillgängligt just nu. Konvertera filen till CSV och försök igen.');
          setUploading(false);
          return;
        }
      } else {
        // Förhandsstöd endast csv/xlsx/xls
        throw new Error('Endast CSV eller Excel-filer stöds');
      }

      setFileInfo({ name: file.name, url: file_url, type: lower.endsWith('.csv') ? 'csv' : 'excel' });
      setRawHeaders(headers);
      setRawRows(rows);
      setStep(2);
    } catch (err) {
      alert(err.message || 'Fel vid uppladdning');
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const headers = ['SKU','Namn','Mängd'];
    const sample = [
      ['SKU001','Exempelprodukt 1','0.25'],
      ['SKU002','Exempelprodukt 2','0.75']
    ];
    const csv = [headers.join(','), ...sample.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metics_bom_mall.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (rawHeaders.length) {
      const lower = rawHeaders.map(h => ({ h, l: h.toLowerCase() }));
      const sku = lower.find(x => x.l === 'sku')?.h;
      const qty = lower.find(x => ['mängd','mangd','qty','quantity','amount'].includes(x.l))?.h;
      if (sku) { setIngredientCol(sku); setNamesNotSku(false); }
      if (qty) setQtyCol(qty);
    }
  }, [rawHeaders]);

  const canGoStep3 = step === 2 && ingredientCol && qtyCol;
  const canImport = step === 5 && selectedProductIds.length > 0 && stats.matched > 0;

  async function handleImport() {
    setImporting(true);
    setImportResult(null);
    try {
      const matchedRows = previewRows.filter(r => r.found && !Number.isNaN(r.qtyKg) && r.qtyKg >= 0);
      const targets = products.filter(p => selectedProductIds.includes(p.id));

      let created = 0; let updated = 0;

      for (const target of targets) {
        // Hämta befintliga BOM-rader för denna finished product
        const existing = await base44.entities.BOMItem.filter({ finished_product_id: target.id });
        const byComponent = new Map();
        for (const b of existing) byComponent.set(b.component_id, b);

        for (const row of matchedRows) {
          const comp = productsBySku.get(row.sku);
          if (!comp) continue;
          const prev = byComponent.get(comp.id);
          if (prev) {
            await base44.entities.BOMItem.update(prev.id, { quantity_per_unit: row.qtyKg, environment: 'production' });
            updated += 1;
          } else {
            await base44.entities.BOMItem.create({ finished_product_id: target.id, component_id: comp.id, quantity_per_unit: row.qtyKg, environment: 'production' });
            created += 1;
          }
        }
      }

      setImportResult({ created, updated, productsCount: targets.length });
      setStep(5);
    } catch (err) {
      alert(err.message || 'Fel vid import');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Metics BOM-import</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Steg 1 – Ladda upp */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>CSV eller Excel (tre kolumner: SKU, Namn, Mängd – matchning sker via SKU)</Label>
                <div className="mt-2 flex items-center gap-3">
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                  <Button disabled className="gap-2" variant="outline">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Laddar upp...' : 'Välj fil'}
                  </Button>
                  <Button onClick={downloadTemplate} className="gap-2" variant="secondary">
                    <Download className="w-4 h-4" />
                    Ladda ner importmall
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Förhandsvisning visas efter uppladdning.</p>
              </div>
            </div>
          )}

          {/* Steg 2 – Kolumnmappning */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-2">
                  <Label>Kolumn för SKU (används för koppling)</Label>
                  <Select value={ingredientCol} onValueChange={setIngredientCol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj kolumn" />
                    </SelectTrigger>
                    <SelectContent>
                      {rawHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Kolumn för mängd</Label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Select value={qtyCol} onValueChange={setQtyCol}>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj kolumn" />
                        </SelectTrigger>
                        <SelectContent>
                          {rawHeaders.map((h) => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Select value={qtyUnit} onValueChange={setQtyUnit}>
                        <SelectTrigger>
                          <SelectValue placeholder="Enhet" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Om g väljs konverteras värden till kg i preview och import.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch id="namesNotSku" checked={namesNotSku} onCheckedChange={setNamesNotSku} />
                <Label htmlFor="namesNotSku">Filen innehåller namn, inte SKU</Label>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Tillbaka</Button>
                <Button disabled={!canGoStep3} onClick={() => setStep(3)}>Fortsätt</Button>
              </div>

              <div>
                <Label>Förhandsgranskning (första 5 rader)</Label>
                <div className="overflow-auto border rounded mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {rawHeaders.map(h => (<TableHead key={h}>{h}</TableHead>))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawRows.slice(0,5).map((r, idx) => (
                        <TableRow key={idx}>
                          {rawHeaders.map(h => (<TableCell key={h}>{String(r[h] ?? '')}</TableCell>))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Steg 3 – Välj färdigvaror + ev. namn→SKU-matchning */}
          {step === 3 && (
            <div className="space-y-6">
              {namesNotSku && (
                <div className="space-y-3">
                  <h3 className="font-medium">Matcha ingrediensnamn till SKU</h3>
                  <p className="text-sm text-slate-600">Koppla varje namn till en produkt-SKU i systemet.</p>
                  <div className="overflow-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Namn från fil</TableHead>
                          <TableHead>SKU i systemet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uniqueIngredientNames.map((name) => (
                          <TableRow key={name}>
                            <TableCell className="font-mono text-xs">{name}</TableCell>
                            <TableCell>
                              <Select
                                value={nameToSkuMap[name] || ""}
                                onValueChange={(v) => setNameToSkuMap(prev => ({ ...prev, [name]: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Välj SKU" />
                                </SelectTrigger>
                                <SelectContent className="max-h-80">
                                  {products.map(p => (
                                    <SelectItem key={p.id} value={p.sku}>
                                      {p.sku} — {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h3 className="font-medium">Välj färdigvaror/blandningar</h3>
                <p className="text-sm text-slate-600">Receptet skapas som BOM för alla valda produkter.</p>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Sök produkt..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  <Badge variant="secondary">{selectedProductIds.length} valda</Badge>
                </div>
                <div className="border rounded max-h-80 overflow-auto p-2">
                  {finishedAndMixProducts
                    .filter(p => !search || (p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())))
                    .map(p => {
                      const checked = selectedProductIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedProductIds(prev => v ? [...prev, p.id] : prev.filter(id => id !== p.id));
                            }}
                          />
                          <span className="font-mono text-xs text-slate-600">{p.sku}</span>
                          <span className="text-sm">{p.name}</span>
                          <Badge className="ml-auto" variant="outline">{p.type}</Badge>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Tillbaka</Button>
                <Button onClick={() => setStep(4)}>Fortsätt</Button>
              </div>
            </div>
          )}

          {/* Steg 4 – Preview */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">{stats.total} ingredienser</Badge>
                <Badge className="bg-green-100 text-green-800">{stats.matched} matchade</Badge>
                <Badge className="bg-amber-100 text-amber-800">{stats.missing} saknas</Badge>
                <Badge variant="outline">Kopplas till {selectedProductIds.length} produkter</Badge>
              </div>
              {qtyUnit === 'g' && (
                <div className="text-sm text-slate-600">
                  Värden konverterade från g till kg (dividerat med 1000).
                </div>
              )}

              <div className="overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produktnamn</TableHead>
                      <TableHead>Mängd (kg/1 kg)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{r.sku || r.rawIngredient}</TableCell>
                        <TableCell>{r.productName || '-'}</TableCell>
                        <TableCell>{Number.isNaN(r.qtyKg) ? '-' : r.qtyKg}</TableCell>
                        <TableCell>
                          {r.found ? (
                            <div className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-4 h-4" />OK</div>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Saknas i systemet</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>Tillbaka</Button>
                <Button disabled={selectedProductIds.length === 0 || stats.matched === 0} onClick={() => setStep(5)}>Fortsätt</Button>
              </div>
            </div>
          )}

          {/* Steg 5 – Importera */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-slate-700">Klicka på Importera för att skapa/uppdatera BOM för valda produkter.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)}>Tillbaka</Button>
                <Button onClick={handleImport} disabled={importing} className="gap-2">
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />} Importera
                </Button>
              </div>
              {importResult && (
                <div className="rounded border p-3 bg-slate-50">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Import klar
                  </div>
                  <p className="text-sm mt-1">{importResult.created} BOM-rader skapade, {importResult.updated} uppdaterade, fördelade på {importResult.productsCount} produkter.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigationsrad för att byta steg snabbt */}
      <div className="flex gap-2 text-xs text-slate-500">
        <span>Steg:</span>
        {[1,2,3,4,5].map(s => (
          <button key={s} className={`px-2 py-1 rounded border ${step===s? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setStep(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}