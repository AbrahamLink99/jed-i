import React, { useState, useEffect } from 'react';
import AlertList from '@/components/alerts/AlertList';
import WeeklySummary from '@/components/alerts/WeeklySummary';
import { evaluateInventoryAlerts } from '@/components/alerts/AlertEvaluator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function AlertsPage() {
  const [productType, setProductType] = useState('all');
  const [stockMode, setStockMode] = useState('all');
  const [statusMode, setStatusMode] = useState('active');

  useEffect(() => {
    evaluateInventoryAlerts();
    const interval = setInterval(evaluateInventoryAlerts, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <WeeklySummary />

        <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="space-y-1">
            <Label>Artikeltyp</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Alla typer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla typer</SelectItem>
                <SelectItem value="raw_material">Råvara</SelectItem>
                <SelectItem value="finished_good">Färdigvara</SelectItem>
                <SelectItem value="packaging">Förpackning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Lagerläge</Label>
            <Select value={stockMode} onValueChange={setStockMode}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Alla lägen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla lägen</SelectItem>
                <SelectItem value="out">Slut</SelectItem>
                <SelectItem value="below_safety">Under säkerhetslager</SelectItem>
                <SelectItem value="low_stock">Lågt i lager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusMode} onValueChange={setStatusMode}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Alla aktiva" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Alla aktiva</SelectItem>
              <SelectItem value="deprioritized">Ej prioriterad</SelectItem>
              <SelectItem value="closed">Stängda</SelectItem>
              <SelectItem value="all">Alla</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>

        <AlertList productTypeFilter={productType} stockFilter={stockMode} statusFilter={statusMode} />
      </div>
    </div>
  );
}