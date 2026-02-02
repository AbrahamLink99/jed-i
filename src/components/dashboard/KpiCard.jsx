import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KpiCard({ title, value, trend, delta, description, unit = '%' }) {
  const trendIcon = {
    up: <TrendingUp className="w-4 h-4" />,
    down: <TrendingDown className="w-4 h-4" />,
    neutral: <Minus className="w-4 h-4" />
  };

  const trendColor = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-slate-500'
  };

  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        <div className={cn('flex items-center gap-1', trendColor[trend])}>
          {trendIcon[trend]}
          <span className="text-sm font-semibold">
            {delta > 0 ? '+' : ''}{delta}{unit}
          </span>
        </div>
      </div>
      
      <div className="metric-value mb-2">
        {value}
        <span className="text-2xl text-slate-500 ml-1">{unit}</span>
      </div>
      
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}