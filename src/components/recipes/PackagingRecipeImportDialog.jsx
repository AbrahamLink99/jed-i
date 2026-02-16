import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEnvironmentFilter } from "@/components/environment/useEnvironmentFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

export default function PackagingRecipeImportDialog({ open, onOpenChange, onImported, availableProducts = [] }) {
  const envFilter = useEnvironmentFilter();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [createdCount, setCreatedCount] = useState(0);

  const productBySku = useMemo(() => {
    const map = {};
    availableProducts.forEach(p => { map[p.sku] = p; });
    return map;
  }, [availableProducts]);

  const sample = `mix_sku,finished_sku,finished_name,fill_ml_per_unit,active,component_1_sku,component_1_qty,component_2_sku,component_2_qty\nSHAMPOO-MIX,SHAMPOO-250-FO,Shampo Volym 250ml Doft,250,true,BOTTLE-250,1,CAP-250,1`;

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setRows([]);
    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Extract using permissive schema with up to 10 component pairs
      const schema = {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            mix_sku: { type: "string" },
            finished_sku: { type: "string" },
            finished_name: { type: "string" },
            fill_ml_per_unit: { type: "number" },
            active: { anyOf: [{ type: "boolean" }, { type: "string" }, { type: "number" }] },
            component_1_sku: { type: "string" }, component_1_qty: { type: "number" },
            component_2_sku: { type: "string" }, component_2_qty: { type: "number" },
            component_3_sku: { type: "string" }, component_3_qty: { type: "number" },
            component_4_sku: { type: "string" }, component_4_qty: { type: "number" },
            component_5_sku: { type: "string" }, component_5_qty: { type: "number" },
            component_6_sku: { type: "string" }, component_6_qty: { type: "number" },
            component_7_sku: { type: "string" }, component_7_qty: { type: "number" },
            component_8_sku: { type: "string" }, component_8_qty: { type: "number" },
            component_9_sku: { type: "string" }, component_9_qty: { type: "number" },
            component_10_sku: { type: "string" }, component_10_qty: { type: "number" }
          }
        }
      };
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: schema });
      if (extracted.status !== 'success' || !extracted.output) {
        throw new Error(extracted.details || 'Kunde inte läsa filen');
      }
      const out = Array.isArray(extracted.output) ? extracted.output : [extracted.output];
      setRows(out);
    } catch (e) {
      setError(e?.message || 'Fel vid import');
    } finally {
      setLoading(false);
    }
  };

  const toBoolean = (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return ['true','1','yes','y','ja'].includes(s);
    }
    return true;
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setLoading(true);
    setError("");
    try {
      const payloads = rows.map((r) => {
        const components = [];
        for (let i = 1; i <= 10; i++) {
          const sku = r[`component_${i}_sku`];
          const qty = r[`component_${i}_qty`];
          if (sku && (qty || qty === 0)) {
            components.push({ component_sku: String(sku), component_name: productBySku[String(sku)]?.name || String(sku), qty_per_unit: Number(qty) });
          }
        }
        const finishedName = r.finished_name || productBySku[r.finished_sku]?.name || r.finished_sku;
        return {
          environment: envFilter.environment,
          mix_sku: String(r.mix_sku).trim(),
          finished_sku: String(r.finished_sku).trim(),
          finished_name: finishedName,
          fill_ml_per_unit: Number(r.fill_ml_per_unit),
          components,
          active: toBoolean(r.active)
        };
      }).filter(p => p.mix_sku && p.finished_sku && p.fill_ml_per_unit);

      if (!payloads.length) throw new Error('Inga giltiga rader att importera');

      await base44.entities.PackagingRecipe.bulkCreate(payloads);
      setCreatedCount(payloads.length);
      onImported?.(payloads.length);
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'Kunde inte skapa tappningsrecept');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { setFile(null); setRows([]); setError(""); setCreatedCount(0); } onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importera tappningsrecept via CSV</DialogTitle>
          <DialogDescription>
            Kolumner: mix_sku, finished_sku, finished_name (valfri), fill_ml_per_unit, active (true/false), samt parvis component_N_sku, component_N_qty.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(sample)}>Kopiera CSV-exempel</Button>
            <Button onClick={handleExtract} disabled={!file || loading} className="gap-2">
              <Upload className="w-4 h-4" /> Läs in
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="border rounded-lg">
              <div className="p-3 flex items-center justify-between">
                <div className="text-sm text-slate-600">Rader funna: <span className="font-medium">{rows.length}</span></div>
                <Badge variant="outline">Miljö: {envFilter.environment}</Badge>
              </div>
              <div className="max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mix SKU</TableHead>
                      <TableHead>Färdig SKU</TableHead>
                      <TableHead>Fyll (ml)</TableHead>
                      <TableHead>Komponenter</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 10).map((r, i) => {
                      const comps = [];
                      for (let j = 1; j <= 10; j++) {
                        const s = r[`component_${j}_sku`];
                        const q = r[`component_${j}_qty`];
                        if (s && (q || q === 0)) comps.push(`${s}×${q}`);
                      }
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{r.mix_sku}</TableCell>
                          <TableCell className="font-mono text-sm">{r.finished_sku}</TableCell>
                          <TableCell>{r.fill_ml_per_unit}</TableCell>
                          <TableCell className="text-sm text-slate-600">{comps.join(', ')}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button onClick={handleImport} disabled={!rows.length || loading} className="gap-2">
              {loading ? 'Importerar...' : (<><CheckCircle2 className="w-4 h-4" /> Importera {rows.length} rader</>)}
            </Button>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" /> Tips: Lägg upp färdigvaru-SKU:er i Produkter först för att få rätt namn automatiskt.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}