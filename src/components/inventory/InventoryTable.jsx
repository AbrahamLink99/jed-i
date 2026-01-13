import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, AlertTriangle, Package } from 'lucide-react';
import { cn } from "@/lib/utils";

const typeLabels = {
  finished_good: 'Färdigvara',
  raw_material: 'Råvara',
  packaging: 'Förpackning',
  label: 'Etikett'
};

const typeColors = {
  finished_good: 'bg-indigo-100 text-indigo-700',
  raw_material: 'bg-amber-100 text-amber-700',
  packaging: 'bg-cyan-100 text-cyan-700',
  label: 'bg-pink-100 text-pink-700'
};

export default function InventoryTable({ 
  products = [], 
  stockData = {},
  sortField,
  sortDirection,
  onSort,
  onProductClick 
}) {
  const handleSort = (field) => {
    onSort?.(field);
  };

  const SortHeader = ({ field, children }) => (
    <TableHead 
      className="cursor-pointer hover:bg-slate-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 text-slate-400" />
      </div>
    </TableHead>
  );

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Inga produkter hittades</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader field="sku">SKU</SortHeader>
            <SortHeader field="name">Namn</SortHeader>
            <TableHead>Typ</TableHead>
            <SortHeader field="onHand">I lager</SortHeader>
            <TableHead>Reserverat</TableHead>
            <SortHeader field="available">Tillgängligt</SortHeader>
            <TableHead>Säkerhet</TableHead>
            <TableHead>Enhet</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const stock = stockData[product.id] || { onHand: 0, reserved: 0, available: 0 };
            const belowSafety = stock.onHand < (product.safety_stock || 0);

            return (
              <TableRow 
                key={product.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => onProductClick?.(product)}
              >
                <TableCell className="font-mono font-medium">{product.sku}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {product.name}
                    {belowSafety && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(typeColors[product.type], "font-normal")}>
                    {typeLabels[product.type]}
                  </Badge>
                </TableCell>
                <TableCell className={cn("font-semibold", belowSafety && "text-amber-600")}>
                  {stock.onHand?.toLocaleString('sv-SE')}
                </TableCell>
                <TableCell className="text-slate-500">
                  {stock.reserved?.toLocaleString('sv-SE')}
                </TableCell>
                <TableCell className="font-semibold text-emerald-600">
                  {stock.available?.toLocaleString('sv-SE')}
                </TableCell>
                <TableCell className="text-slate-500">
                  {product.safety_stock?.toLocaleString('sv-SE') || '-'}
                </TableCell>
                <TableCell className="text-slate-500">{product.unit}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}