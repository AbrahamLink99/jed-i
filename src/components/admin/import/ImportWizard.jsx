import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from '@tanstack/react-query';
import { useEnvironmentFilter } from "@/components/environment/useEnvironmentFilter";
import { Upload, CheckCircle2, AlertTriangle, Download } from "lucide-react";

// --- Utils ---
const allowedItemTypes = ["raw_material", "bulk", "finished", "packaging", "label"]; // input-accepted
const mapItemTypeToProduct = (val) => {
  const v = (val || "").toString().trim().toLowerCase();
  if (v === "finished" || v === "finished_good") return "finished_good";
  if (v === "packaging") return "packaging";
  if (v === "label") return "label";
  if (v === "bulk") return "raw_material"; // map bulk to raw_material in our schema
  return "raw_material";
};

const normalizeUom = (val) => {
  const v = (val || "").toString().trim().toLowerCase();
  if (["st", "pcs", "pc", "styck", "stk"].includes(v)) return "pcs";
  if (["kg", "kilogram"].includes(v)) return "kg";
  if (["l", "liter"].includes(v)) return "liter";
  if (["rulle", "roll"].includes(v)) return "roll";
  return v || "pcs";
};

function parseCSV(text, delimiter) {
  // Simple CSV parser with quote support for "," or ";"
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  const d = delimiter === ';' ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { // escaped quote
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === d && !inQuotes) {
      current.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++; // handle CRLF
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  // Trim trailing empty lines
  return rows.filter(r => r.length && r.some(v => (v || '').trim() !== ''));
}

const parseNumber = (raw, decimalFormat) => {
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  // remove currency
  s = s.replace(/\b(kr|KR|Kr|sek|SEK|Sek)\b/g, '');
  // remove spaces
  s = s.replace(/\s+/g, '');
  if (decimalFormat === 'sv') {
    // dot thousands, comma decimal
    s = s.replace(/\./g, '');
    s = s.replace(/,/g, '.');
  } else {
    // comma thousands, dot decimal
    s = s.replace(/,(?=\d{3}(\D|$))/g, '');
  }
  // keep only digits, dot, minus
  s = s.replace(/[^0-9.-]/g, '');
  const num = parseFloat(s);
  return isNaN(num) ? NaN : num;
};

const systemFields = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'name', label: 'Namn', required: true },
  { key: 'item_type', label: 'Typ (item_type)', required: false },
  { key: 'uom', label: 'Enhet (uom)', required: false },
  { key: 'on_hand_qty', label: 'Startsaldo (on_hand_qty)', required: false },
  { key: 'unit_cost', label: 'Kostnad (unit_cost)', required: false },
  { key: 'supplier', label: 'Leverantör', required: false },
  { key: 'min_level', label: 'Säkerhetslager (min_level)', required: false },
  { key: 'notes', label: 'Anteckningar', required: false },
];

const importTypeOptions = [
  { key: 'label', label: 'Etikett' },
  { key: 'packaging', label: 'Förpackning' },
  { key: 'raw_material', label: 'Råvara' },
  { key: 'bulk', label: 'Bulk' },
  { key: 'finished', label: 'Färdigvara' },
];

function getFieldsForType(importType) {
  switch (importType) {
    case 'label':
      return [
        { key: 'sku', label: 'SKU', required: true },
        { key: 'name', label: 'Namn', required: true },
        { key: 'supplier', label: 'Leverantör', required: false },
        { key: 'unit_cost', label: 'Kostnad (kr/st)', required: false },
        { key: 'on_hand_qty', label: 'Startsaldo (st)', required: false },
        { key: 'min_level', label: 'Säkerhetslager (st)', required: false },
      ];
    case 'packaging':
      return [
        { key: 'sku', label: 'SKU', required: true },
        { key: 'name', label: 'Namn', required: true },
        { key: 'supplier', label: 'Leverantör', required: false },
        { key: 'unit_cost', label: 'Kostnad (kr/st)', required: false },
        { key: 'on_hand_qty', label: 'Startsaldo (st)', required: false },
        { key: 'min_level', label: 'Säkerhetslager (st)', required: false },
      ];
    case 'raw_material':
      return [
        { key: 'sku', label: 'SKU', required: true },
        { key: 'name', label: 'Namn', required: true },
        { key: 'supplier', label: 'Leverantör', required: false },
        { key: 'unit_cost', label: 'Kostnad (kr/kg)', required: false },
        { key: 'on_hand_qty_kg', label: 'Startsaldo (kg)', required: false },
        { key: 'min_level_kg', label: 'Säkerhetslager (kg)', required: false },
        { key: 'lead_time_days', label: 'Ledtid (dagar)', required: false },
      ];
    case 'bulk':
      return [
        { key: 'sku', label: 'SKU', required: true },
        { key: 'name', label: 'Namn', required: true },
        { key: 'on_hand_qty_kg', label: 'Startsaldo (kg)', required: false },
        { key: 'min_level_kg', label: 'Säkerhetslager (kg)', required: false },
      ];
    case 'finished':
      return [
        { key: 'sku', label: 'SKU', required: true },
        { key: 'name', label: 'Namn', required: true },
        { key: 'variant_size_ml', label: 'Variantstorlek (ml)', required: false },
        { key: 'unit_cost', label: 'Kostnad (kr/st)', required: false },
        { key: 'on_hand_qty', label: 'Startsaldo (st)', required: false },
        { key: 'min_level', label: 'Säkerhetslager (st)', required: false },
      ];
    default:
      return [];
  }
}

function defaultItemType(importType) {
  switch (importType) {
    case 'label': return 'label';
    case 'packaging': return 'packaging';
    case 'finished': return 'finished_good';
    case 'bulk': return 'raw_material'; // mapped to raw_material in schema
    case 'raw_material':
    default: return 'raw_material';
  }
}

function defaultUom(importType) {
  // 'st' desired in UI, stored as 'pcs'
  switch (importType) {
    case 'raw_material':
    case 'bulk':
      return 'kg';
    case 'label':
    case 'packaging':
    case 'finished':
    default:
      return 'st';
  }
}

const profileStorageKey = (importType) => `importProfile:type:${importType}`;

function StepHeader({ title, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

export default function ImportWizard() {
  const envFilter = useEnvironmentFilter();
  const queryClient = useQueryClient();

  // Step state
  const [step, setStep] = useState(1);
  const [delimiter, setDelimiter] = useState(',');
  const [decimalFormat, setDecimalFormat] = useState('sv'); // 'sv' or 'dot'
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);

  // Import context
  const [importType, setImportType] = useState('raw_material');
  useEffect(() => { setMapping({}); }, [importType]);
  const dynamicFields = useMemo(() => getFieldsForType(importType), [importType]);

  // Mapping state
  const [mapping, setMapping] = useState({}); // { sku: 'Column A', ... }
  const [selectedProfile, setSelectedProfile] = useState('');

  // Import results
  const [previewRows, setPreviewRows] = useState([]); // normalized with errors
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [inlineError, setInlineError] = useState('');
  const [duplicatesInfo, setDuplicatesInfo] = useState([]);

  // Load profile
  const loadProfile = () => {
    const key = profileStorageKey(importType);
    const raw = localStorage.getItem(key);
    if (!raw) {
      toast.error('Ingen sparad profil hittades för denna importtyp');
      return;
    }
    const pf = JSON.parse(raw);
    setMapping(pf.mapping || {});
    setDelimiter(pf.delimiter || ',');
    setDecimalFormat(pf.decimalFormat || 'sv');
    toast.success('Profil laddad');
  };

  const saveProfile = () => {
    const key = profileStorageKey(importType);
    const pf = { mapping, delimiter, decimalFormat };
    localStorage.setItem(key, JSON.stringify(pf));
    toast.success('Profil sparad');
  };

  // File upload + parsing
  const onFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    const parsed = parseCSV(text, delimiter);
    if (!parsed.length) {
      toast.error('Filen verkar vara tom.');
      return;
    }
    setHeaders(parsed[0]);
    setRows(parsed.slice(1));
    // Auto-map heuristics (only by name exact match, not values)
    const hdrLower = Object.fromEntries(parsed[0].map((h, i) => [String(h || '').toLowerCase().trim(), h]));
    const newMap = { ...mapping };
    dynamicFields.forEach(f => {
      if (!newMap[f.key]) {
        if (hdrLower[f.key]) newMap[f.key] = hdrLower[f.key];
        if (f.key === 'uom' && hdrLower['unit']) newMap[f.key] = hdrLower['unit'];
        if (f.key === 'unit_cost' && (hdrLower['cost'] || hdrLower['unit_cost'])) newMap[f.key] = hdrLower['cost'] || hdrLower['unit_cost'];
        if (f.key === 'on_hand_qty' && (hdrLower['on_hand'] || hdrLower['qty'] || hdrLower['stock'])) newMap[f.key] = hdrLower['on_hand'] || hdrLower['qty'] || hdrLower['stock'];
        if (f.key === 'on_hand_qty_kg' && (hdrLower['on_hand_qty_kg'] || hdrLower['on_hand_kg'] || hdrLower['qty_kg'] || hdrLower['stock_kg'])) newMap[f.key] = hdrLower['on_hand_qty_kg'] || hdrLower['on_hand_kg'] || hdrLower['qty_kg'] || hdrLower['stock_kg'];
        if (f.key === 'min_level_kg' && (hdrLower['min_level_kg'] || hdrLower['safety_stock_kg'])) newMap[f.key] = hdrLower['min_level_kg'] || hdrLower['safety_stock_kg'];
        if (f.key === 'lead_time_days' && (hdrLower['lead_time_days'] || hdrLower['lead_time'])) newMap[f.key] = hdrLower['lead_time_days'] || hdrLower['lead_time'];
        if (f.key === 'variant_size_ml' && (hdrLower['variant_size_ml'] || hdrLower['size_ml'])) newMap[f.key] = hdrLower['variant_size_ml'] || hdrLower['size_ml'];
      }
    });
    setMapping(newMap);
    setStep(1);
  };

  // Re-parse when delimiter changes with same file content (best-effort)
  const reparse = () => {
    // Cannot re-read file content without storing it; prompt to re-upload if needed
    toast.message('Ändrad avgränsare används på nästa uppladdning. Ladda upp filen igen om något ser konstigt ut.');
  };

  const downloadTemplate = () => {
    const headers = dynamicFields.map(f => f.key);
    const csv = headers.join(delimiter) + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mall_${importType}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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

  // Build preview rows with normalization + validation
  const buildPreview = () => {
    if (!headers.length) {
      toast.error('Ladda upp en CSV först.');
      return;
    }
    const mapped = rows.slice(0, 10).map((row, i) => {
      const sku = String(getVal(row, 'sku') || '').trim();
      const name = String(getVal(row, 'name') || '').trim();
      const itemTypeRaw = String(getVal(row, 'item_type') || '').trim();
      const uomRaw = String(getVal(row, 'uom') || '').trim();
      const supplier = String(getVal(row, 'supplier') || '').trim();
      const notes = String(getVal(row, 'notes') || '').trim();
      const minLevelRaw = getVal(row, 'min_level');
      const minLevelKgRaw = getVal(row, 'min_level_kg');
      const unitCostRaw = getVal(row, 'unit_cost');
      const onHandRaw = getVal(row, 'on_hand_qty');
      const onHandKgRaw = getVal(row, 'on_hand_qty_kg');
      const leadTimeRaw = getVal(row, 'lead_time_days');
      const variantSizeRaw = getVal(row, 'variant_size_ml');

      const errors = [];
      const warnings = [];

      // item_type validation (if provided)
      if (itemTypeRaw) {
        const ok = allowedItemTypes.includes(itemTypeRaw.toLowerCase());
        if (!ok) errors.push('Ogiltig item_type: ' + itemTypeRaw);
      }

      // parse numerics
      const minLevelParsed = parseNumber(importType === 'raw_material' || importType === 'bulk' ? minLevelKgRaw : minLevelRaw, decimalFormat);
      const minLevel = isNaN(minLevelParsed) ? 0 : minLevelParsed;
      let unitCost = parseNumber(unitCostRaw, decimalFormat);
      let onHandParsed = parseNumber((importType === 'raw_material' || importType === 'bulk') ? onHandKgRaw : onHandRaw, decimalFormat);
      let onHand = isNaN(onHandParsed) ? null : onHandParsed;
      const leadTimeNum = parseNumber(leadTimeRaw, decimalFormat);
      const leadTimeDays = isNaN(leadTimeNum) ? null : Math.round(leadTimeNum);
      const variantSizeNum = parseNumber(variantSizeRaw, decimalFormat);
      const variant_size_ml = isNaN(variantSizeNum) ? null : Math.round(variantSizeNum);

      if (importType === 'label' || importType === 'packaging' || importType === 'finished') {
        if (unitCostRaw && isNaN(unitCost)) errors.push('unit_cost ej numerisk');
        if (!unitCostRaw || isNaN(unitCost)) unitCost = 0;
      } else {
        if (isNaN(unitCost)) { unitCost = 0; warnings.push('unit_cost saknas eller ej numerisk'); }
      }
      if (((importType === 'raw_material' || importType === 'bulk') && onHandKgRaw) || (importType !== 'raw_material' && importType !== 'bulk' && onHandRaw)) {
        if (isNaN(onHandParsed)) errors.push('on_hand_qty ej numerisk');
      }

      if (importType === 'raw_material' && leadTimeRaw && (leadTimeDays === null || !Number.isInteger(leadTimeDays))) {
        errors.push('lead_time_days måste vara heltal');
      }
      if (importType === 'finished' && variantSizeRaw && (variant_size_ml === null || !Number.isInteger(variant_size_ml))) {
        errors.push('variant_size_ml måste vara heltal');
      }

      // defaults
      const itemType = mapItemTypeToProduct(itemTypeRaw || defaultItemType(importType));
      const uom = normalizeUom(uomRaw || defaultUom(importType));

      if (!sku) errors.push('SKU saknas');
      if (!name) errors.push('Namn saknas');

      return {
        _row: i + 1,
        sku,
        name,
        item_type: itemType,
        uom,
        supplier,
        notes,
        min_level: minLevel,
        unit_cost: unitCost,
        on_hand_qty: onHand,
        lead_time_days: leadTimeDays,
        variant_size_ml,
        _errors: errors,
        _warnings: warnings,
      };
    });

    // Uniqueness of SKU within preview set (first 10)
    const seen = new Set();
    mapped.forEach(r => {
      if (seen.has(r.sku)) r._errors.push('SKU ej unik i förhandsgranskning');
      else seen.add(r.sku);
    });

    // Detect duplicates across the ENTIRE file and mark them in preview + block import
    const allSkus = rows.map((row) => String(getVal(row, 'sku') || '').trim()).filter(Boolean);
    const skuCounts = allSkus.reduce((acc, s) => {
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const dups = Object.entries(skuCounts)
      .filter(([_, count]) => count > 1)
      .map(([sku, count]) => ({ sku, count }));
    setDuplicatesInfo(dups);
    const dupSet = new Set(dups.map(d => d.sku));
    mapped.forEach(r => {
      if (r.sku && dupSet.has(r.sku)) {
        r._errors.push(`SKU dubblett i filen (${skuCounts[r.sku]} ggr)`);
      }
    });

    setPreviewRows(mapped);
    setStep(3);
  };

  const canProceedMapping = useMemo(() => {
    return dynamicFields.filter(f => f.required).every(f => mapping[f.key]);
  }, [mapping, dynamicFields]);

  const doImport = async () => {
    setInlineError('');
    if (isSandboxHost) {
      toast.error('Import är avstängt i sandbox‑förhandsvisning.');
      return;
    }
    if (!previewRows.length) {
      const msg = 'Skapa en förhandsgranskning först.';
      setInlineError(msg);
      toast.error(msg);
      return;
    }
    const hasErrors = previewRows.some(r => r._errors.length);
    if (hasErrors) {
      const msg = 'Åtgärda fel i förhandsgranskningen innan import.';
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    setImporting(true);
    toast.message('Startar import...');
    const user = await base44.auth.me().catch(() => null);
    let created = 0, updated = 0, adjusted = 0;
    const errors = [];

    // Uniqueness check across entire file (block import + list all)
    const allSkusRaw = rows.map((row) => String(getVal(row, 'sku') || '').trim()).filter(Boolean);
    const skuCountMap = allSkusRaw.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
    const dupList = Object.entries(skuCountMap).filter(([_, c]) => c > 1);
    if (dupList.length) {
      const sample = dupList.slice(0, 10).map(([s, c]) => `${s}×${c}`).join(', ');
      const extra = dupList.length > 10 ? ` …(+${dupList.length - 10} fler)` : '';
      const msg = 'Dubblett-SKU i filen: ' + sample + extra;
      setInlineError(msg);
      toast.error(msg);
      setImporting(false);
      return;
    }

    try {
      // Helpers
      const chunk = (arr, size) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const runWithConcurrency = async (items, limit, handler) => {
        const results = new Array(items.length);
        let idx = 0;
        await Promise.all(
          Array.from({ length: Math.min(limit, items.length || 1) }).map(async () => {
            while (true) {
              const current = idx++;
              if (current >= items.length) break;
              try {
                results[current] = await handler(items[current], current);
              } catch (e) {
                results[current] = { __error: e };
              }
            }
          })
        );
        return results;
      };

      // Normalize ALL rows (not only first 10)
      const all = rows.map((row) => {
        const sku = String(getVal(row, 'sku') || '').trim();
        const name = String(getVal(row, 'name') || '').trim();
        const itemType = mapItemTypeToProduct(String(getVal(row, 'item_type') || defaultItemType(importType)));
        const uom = normalizeUom(String(getVal(row, 'uom') || defaultUom(importType)));
        const supplier = String(getVal(row, 'supplier') || '').trim();
        const notes = String(getVal(row, 'notes') || '').trim();
        const minLevelRaw = getVal(row, 'min_level');
        const minLevelKgRaw = getVal(row, 'min_level_kg');
        const ml = parseNumber((importType === 'raw_material' || importType === 'bulk') ? minLevelKgRaw : minLevelRaw, decimalFormat);
        const minLevel = isNaN(ml) ? 0 : ml;
        let unitCost = parseNumber(getVal(row, 'unit_cost'), decimalFormat);
        if (isNaN(unitCost)) unitCost = 0;
        const onHandRaw = getVal(row, 'on_hand_qty');
        const onHandKgRaw = getVal(row, 'on_hand_qty_kg');
        const oh = parseNumber((importType === 'raw_material' || importType === 'bulk') ? onHandKgRaw : onHandRaw, decimalFormat);
        let onHand = isNaN(oh) ? null : oh;
        const leadTimeNum = parseNumber(getVal(row, 'lead_time_days'), decimalFormat);
        const lead_time_days = isNaN(leadTimeNum) ? undefined : Math.round(leadTimeNum);
        const variantSizeNum = parseNumber(getVal(row, 'variant_size_ml'), decimalFormat);
        const variant_size_ml = isNaN(variantSizeNum) ? undefined : Math.round(variantSizeNum);
        return { sku, name, item_type: itemType, uom, supplier, notes, min_level: minLevel, unit_cost: unitCost, on_hand_qty: onHand, lead_time_days, variant_size_ml };
      }).filter(r => r.sku && r.name);

      // Lookup existing products with concurrency 3
      const skuToExisting = {};
      await runWithConcurrency(all, 3, async (r) => {
        const found = await base44.entities.Product.filter({ sku: r.sku, environment: envFilter.environment });
        if (found && found.length) skuToExisting[r.sku] = found[0];
      });

      const toUpdate = all.filter(r => skuToExisting[r.sku]);
      const toCreate = all.filter(r => !skuToExisting[r.sku]);

      // Updates with concurrency 3
      await runWithConcurrency(toUpdate, 3, async (r) => {
        const p0 = skuToExisting[r.sku];
        const payload = {
          environment: envFilter.environment,
          sku: r.sku,
          name: r.name,
          type: r.item_type,
          unit: r.uom,
          supplier: r.supplier || p0.supplier,
          notes: r.notes || p0.notes,
          safety_stock: r.min_level,
          cost_per_unit: r.unit_cost,
          active: true,
        };
        if (r.lead_time_days !== undefined) payload.lead_time_days = r.lead_time_days;
        try {
          await base44.entities.Product.update(p0.id, payload);
          updated += 1;
        } catch (e) {
          errors.push({ sku: r.sku, message: e?.message || String(e), phase: 'update' });
        }
      });

      // Bulk create new in chunks of 25
      const createdPairs = [];
      for (const ch of chunk(toCreate, 25)) {
        if (!ch.length) continue;
        const payloads = ch.map((r) => {
          const p = {
            environment: envFilter.environment,
            sku: r.sku,
            name: r.name,
            type: r.item_type,
            unit: r.uom,
            safety_stock: r.min_level,
            cost_per_unit: r.unit_cost,
            active: true,
          };
          if (r.supplier) p.supplier = r.supplier;
          if (r.notes) p.notes = r.notes;
          if (r.lead_time_days !== undefined) p.lead_time_days = r.lead_time_days;
          return p;
        });
        try {
          const res = await base44.entities.Product.bulkCreate(payloads);
          const arr = Array.isArray(res) ? res : [];
          arr.forEach((prod, idx) => {
            createdPairs.push({ product: prod, row: ch[idx] });
          });
          created += arr.length;
        } catch (e) {
          ch.forEach((r) => errors.push({ sku: r.sku, message: 'Create failed (batch): ' + (e?.message || String(e)), phase: 'create' }));
        }
      }

      // Ledger adjustments (concurrency 3) for both updated and created
      const ledgerTasks = [];
      toUpdate.forEach((r) => {
        if (r.on_hand_qty !== null && !isNaN(r.on_hand_qty)) {
          ledgerTasks.push({ productId: skuToExisting[r.sku]?.id, sku: r.sku, name: r.name, qty: r.on_hand_qty });
        }
      });
      createdPairs.forEach(({ product, row: r }) => {
        if (r.on_hand_qty !== null && !isNaN(r.on_hand_qty)) {
          ledgerTasks.push({ productId: product.id, sku: r.sku, name: r.name, qty: r.on_hand_qty });
        }
      });
      await runWithConcurrency(ledgerTasks, 3, async (t) => {
        try {
          await base44.entities.InventoryLedger.create({
            environment: envFilter.environment,
            product_id: t.productId,
            product_sku: t.sku,
            product_name: t.name,
            transaction_type: 'adjustment',
            quantity: t.qty,
            reference_type: 'manual',
            notes: 'Startsaldo vid import (' + (importType === 'raw_material' || importType === 'bulk' ? 'kg' : 'st') + ')',
          });
          adjusted += 1;
        } catch (e) {
          errors.push({ sku: t.sku, message: e?.message || String(e), phase: 'ledger' });
        }
      });

      // Audit log summary (non-blocking)
      try {
        await base44.entities.AuditLogEntry.create({
          timestamp: new Date().toISOString(),
          actor_email: user?.email || 'unknown',
          actor_role: user?.role || 'admin',
          action_type: 'CREATE',
          entity_type: 'Product',
          summary_message: `Import: ${fileName} → ${created} skapade, ${updated} uppdaterade, ${adjusted} lagerjusteringar, ${errors.length} fel`,
          page_context: 'Admin > Import Wizard'
        });
      } catch (logErr) {
        console.warn('AuditLogEntry failed', logErr);
      }

      setImportResult({ created, updated, adjusted, errors });
      if (errors.length) {
        toast.message(`Import klar med ${errors.length} fel`);
      } else {
        toast.success('Import klar');
      }
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    } catch (e) {
      console.error(e);
      const msg = 'Import misslyckades: ' + (e?.message || String(e));
      setInlineError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  // UI helpers
  const firstTenRows = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Wizard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Step tabs for clarity */}
          <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
            <TabsList>
              <TabsTrigger value="1">1. Fil</TabsTrigger>
              <TabsTrigger value="2" disabled={!headers.length}>2. Mappning</TabsTrigger>
              <TabsTrigger value="3" disabled={!headers.length}>3. Preview</TabsTrigger>
              <TabsTrigger value="4" disabled={!importResult}>4. Import</TabsTrigger>
            </TabsList>

            {/* STEP 1 */}
            <TabsContent value="1" className="space-y-4">
              <StepHeader title="Ladda upp CSV" right={
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <div className="flex items-center gap-2">
                    <Label>Importtyp</Label>
                    <Select value={importType} onValueChange={setImportType}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {importTypeOptions.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Avgränsare</Label>
                    <Select value={delimiter} onValueChange={(v) => { setDelimiter(v); reparse(); }}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value=",">Comma (,)</SelectItem>
                        <SelectItem value=";">Semikolon (;)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Decimal</Label>
                    <Select value={decimalFormat} onValueChange={setDecimalFormat}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sv">Svensk ,</SelectItem>
                        <SelectItem value="dot">Punkt .</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="w-4 h-4 mr-1" /> Ladda ner mall
                  </Button>
                </div>
              } />

              <div className="flex items-center gap-3">
                <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
                <Button variant="outline" onClick={() => { setHeaders([]); setRows([]); setMapping({}); setPreviewRows([]); setImportResult(null); setDuplicatesInfo([]); setStep(1); }}>Rensa</Button>
              </div>
              {fileName && <p className="text-sm text-slate-500">Fil: {fileName}</p>}

              {headers.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">Upptäckta kolumner:</p>
                  <div className="flex flex-wrap gap-2">
                    {headers.map((h, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono">{h || '(tom)'}</span>
                    ))}
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((h, i) => (<TableHead key={i} className="font-mono">{h || '(tom)'}</TableHead>))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {firstTenRows.map((r, ri) => (
                          <TableRow key={ri}>
                            {headers.map((_, ci) => (
                              <TableCell key={ci} className="text-sm">{r[ci]}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {firstTenRows.length === 0 && (
                          <TableRow><TableCell colSpan={headers.length} className="text-center text-slate-500">Inga rader</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Vald importtyp: <span className="font-mono">{importType}</span></p>
                    <Button disabled={!headers.length} onClick={() => setStep(2)}>
                      <Upload className="w-4 h-4 mr-2" /> Fortsätt till mappning
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* STEP 2 */}
            <TabsContent value="2" className="space-y-4">
              <StepHeader title="Mappa kolumner till fält" right={
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={loadProfile}>Ladda profil</Button>
                  <Button variant="outline" onClick={saveProfile}>Spara profil</Button>
                </div>
              } />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dynamicFields.map((f) => {
                  const exampleValue = firstTenRows[0] ? getVal(firstTenRows[0], f.key) : '';
                  return (
                    <div key={f.key} className="space-y-2">
                      <Label>{f.label} {f.required && <span className="text-red-600">*</span>}</Label>
                      <Select value={mapping[f.key] || ''} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj kolumn" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((h, i) => (<SelectItem key={i} value={h}>{h || '(tom)'}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">Exempel: <span className="font-mono">{String(exampleValue || '').slice(0, 40)}</span></p>
                    </div>
                  );
                })}
              </div>

              {!canProceedMapping && (
                <Alert>
                  <AlertDescription>Fyll i obligatoriska fält (SKU och Namn).</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Tillbaka</Button>
                <Button onClick={buildPreview} disabled={!canProceedMapping}>Skapa preview</Button>
              </div>
            </TabsContent>

            {/* STEP 3 */}
            <TabsContent value="3" className="space-y-4">
              <StepHeader title="Förhandsgranskning (10 rader)" />
              {duplicatesInfo.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Dubblett-SKU upptäckta i filen: {duplicatesInfo.slice(0, 10).map(d => `${d.sku}×${d.count}`).join(', ')}
                    {duplicatesInfo.length > 10 ? ` …(+${duplicatesInfo.length - 10} fler)` : ''}
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Namn</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Enhet</TableHead>
                      <TableHead>Min nivå ({importType === 'raw_material' || importType === 'bulk' ? 'kg' : 'st'})</TableHead>
                      <TableHead>Kostnad</TableHead>
                      <TableHead>Startsaldo ({importType === 'raw_material' || importType === 'bulk' ? 'kg' : 'st'})</TableHead>
                      {importType === 'finished' && <TableHead>Variant (ml)</TableHead>}
                      {importType === 'raw_material' && <TableHead>Ledtid (dagar)</TableHead>}
                      <TableHead>Fel/Varningar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r._row}</TableCell>
                        <TableCell className="font-mono">{r.sku}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.item_type}</TableCell>
                        <TableCell>{r.uom}</TableCell>
                        <TableCell>{r.min_level}</TableCell>
                        <TableCell>{r.unit_cost}</TableCell>
                        <TableCell>{r.on_hand_qty ?? '-'}</TableCell>
                        {importType === 'finished' && <TableCell>{r.variant_size_ml ?? '-'}</TableCell>}
                        {importType === 'raw_material' && <TableCell>{r.lead_time_days ?? '-'}</TableCell>}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {r._errors.map((e, ei) => (
                              <span key={ei} className="text-xs text-red-600">• {e}</span>
                            ))}
                            {r._warnings.map((w, wi) => (
                              <span key={wi} className="text-xs text-amber-600">• {w}</span>
                            ))}
                            {!r._errors.length && !r._warnings.length && (
                              <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> OK</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {previewRows.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-slate-500">Ingen data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Alert className="max-w-xl">
                  <AlertDescription>
                    Regler: SKU unik inom import, numeriska fält parsas enligt decimal-val, item_type måste vara raw_material/bulk/finished/packaging/label.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>Tillbaka</Button>
                    <Button onClick={doImport} disabled={importing || !previewRows.length || previewRows.some(r => r._errors.length) || duplicatesInfo.length > 0}>
                      {importing ? 'Importerar...' : 'Importera'}
                    </Button>
                  </div>
                  {(isSandboxHost || !previewRows.length || previewRows.some(r => r._errors.length)) && (
                    <span className="text-xs text-slate-500">
                      {isSandboxHost ? 'Import är avstängt i sandbox‑förhandsvisning.' :
                        (!previewRows.length ? 'Ladda upp och förhandsgranska CSV först.' :
                          (duplicatesInfo.length > 0
                            ? `Dubblett-SKU måste åtgärdas: ${duplicatesInfo.length} st.`
                            : `${previewRows.filter(r => r._errors.length).length} rader har fel som måste åtgärdas.`))}
                    </span>
                  )}
                  {inlineError && (
                    <span className="text-xs text-red-600">{inlineError}</span>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* STEP 4 */}
            <TabsContent value="4" className="space-y-4">
              <StepHeader title="Importresultat" />
              {importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-emerald-50 text-emerald-700">
                      <div className="text-sm">Skapade</div>
                      <div className="text-2xl font-semibold">{importResult.created}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 text-blue-700">
                      <div className="text-sm">Uppdaterade</div>
                      <div className="text-2xl font-semibold">{importResult.updated}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50 text-amber-700">
                      <div className="text-sm">Lagerjusteringar</div>
                      <div className="text-2xl font-semibold">{importResult.adjusted}</div>
                    </div>
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div className="p-4 rounded-lg bg-red-50 text-red-700">
                      <div className="text-sm mb-2">Fel ({importResult.errors.length}) 																	 																 								 							 		 							 				 							 		> första 20:</div>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {importResult.errors.slice(0, 20).map((e, i) => (
                          <li key={i}><span className="font-mono">{e.sku || '-'}</span>: {e.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {!importResult && (
                <Alert>
                  <AlertDescription>
                    Ingen import har körts än.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex justify-end">
                <Button onClick={() => { setStep(1); setHeaders([]); setRows([]); setMapping({}); setPreviewRows([]); setImportResult(null); }}>Ny import</Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Small footnote */}
          <p className="text-xs text-slate-500">Miljö: <span className="font-mono">{envFilter.environment}</span>. Artiklar skapas/uppdateras i vald miljö, och startsaldo loggas som lagerjustering.</p>
        </CardContent>
      </Card>
    </div>
  );
}