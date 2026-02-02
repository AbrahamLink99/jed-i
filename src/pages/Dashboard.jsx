import React, { useState } from 'react';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDashboardMetrics } from '../components/dashboard/dashboardMetrics';
import KpiCard from '@/components/dashboard/KpiCard';
import TrendChart from '@/components/dashboard/TrendChart';
import HistogramChart from '@/components/dashboard/HistogramChart';
import RootCauseTable from '@/components/dashboard/RootCauseTable';
import { AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DashboardPage() {
  const [period, setPeriod] = useState('30');
  const envFilter = useEnvironmentFilter();
  
  // Get dashboard metrics based on selected period and environment
  const metrics = getDashboardMetrics(parseInt(period), envFilter.environment);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Performance Dashboard</h1>
            <p className="text-slate-600 mt-1">
              Översikt av planering, lager, inköp och leveransflöde
            </p>
          </div>
          
          {/* Period Filter */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dagar</SelectItem>
              <SelectItem value="30">30 dagar</SelectItem>
              <SelectItem value="90">90 dagar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mock Data Notice */}
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Demo-läge:</strong> Dashboardens data är för närvarande simulerad. 
            Integration med riktiga mätvärden kommer implementeras baserat på InventoryLedger, 
            Batch, PlanningScenario och InventoryAlert.
          </AlertDescription>
        </Alert>

        {/* BLOCK A: KPI Scoreboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard
            title="Planeringsprecision"
            value={metrics.kpis.planningPrecision.value}
            trend={metrics.kpis.planningPrecision.trend}
            delta={metrics.kpis.planningPrecision.delta}
            description={metrics.kpis.planningPrecision.description}
          />
          <KpiCard
            title="Lagerstabilitet"
            value={metrics.kpis.inventoryStability.value}
            trend={metrics.kpis.inventoryStability.trend}
            delta={metrics.kpis.inventoryStability.delta}
            description={metrics.kpis.inventoryStability.description}
          />
          <KpiCard
            title="Inköpsträffsäkerhet"
            value={metrics.kpis.purchasePrecision.value}
            trend={metrics.kpis.purchasePrecision.trend}
            delta={metrics.kpis.purchasePrecision.delta}
            description={metrics.kpis.purchasePrecision.description}
          />
          <KpiCard
            title="Leveransflöde"
            value={metrics.kpis.deliveryFlow.value}
            trend={metrics.kpis.deliveryFlow.trend}
            delta={metrics.kpis.deliveryFlow.delta}
            description={metrics.kpis.deliveryFlow.description}
          />
        </div>

        {/* BLOCK B: Trender */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TrendChart
            data={metrics.trends.inventoryStability}
            dataKeys={['value']}
            title="Lagerstabilitet över tid"
            yAxisLabel="Stabilitet (%)"
          />
          <TrendChart
            data={metrics.trends.planVsActual}
            dataKeys={['plan', 'actual']}
            title="Plan vs Utfall (Produktion)"
            yAxisLabel="Kvantitet (kg)"
          />
        </div>

        {/* BLOCK C: Precision & Avvikelser */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <HistogramChart
            data={metrics.distributions.planDeviation}
            title="Planavvikelse (fördelning)"
            subtitle="Antal produktioner per avvikelse från plan"
          />
          
          <div className="analytics-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Lageravvikelser</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <div className="text-sm font-medium text-red-900">Under säkerhetslager</div>
                  <div className="text-xs text-red-700 mt-1">
                    {metrics.distributions.inventoryIssues.productsAtRisk} av {metrics.distributions.inventoryIssues.totalProducts} produkter
                  </div>
                </div>
                <div className="text-3xl font-bold text-red-900">
                  {metrics.distributions.inventoryIssues.belowSafety}%
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div>
                  <div className="text-sm font-medium text-amber-900">Över maxnivå</div>
                  <div className="text-xs text-amber-700 mt-1">Kapitalbindning</div>
                </div>
                <div className="text-3xl font-bold text-amber-900">
                  {metrics.distributions.inventoryIssues.aboveMax}%
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-900">Snittid i riskzon</div>
                  <div className="text-xs text-slate-600 mt-1">Per produkt som riskerar stockout</div>
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {metrics.distributions.inventoryIssues.avgTimeInRisk}
                  <span className="text-base text-slate-600 ml-2">dagar</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCK D: Rotsaker */}
        <div className="mb-8">
          <RootCauseTable
            data={metrics.rootCauses}
            title="Rotsaker – Senaste 30 dagarna"
          />
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-slate-500 mt-12 pb-8">
          <p>
            Dashboard uppdaterad: {new Date(metrics.metadata.generatedAt).toLocaleString('sv-SE')}
          </p>
          <p className="mt-1">
            Miljö: <span className="font-medium">{metrics.metadata.environment}</span> • 
            Period: <span className="font-medium">{metrics.metadata.period} dagar</span>
          </p>
        </div>
      </div>
    </div>
  );
}