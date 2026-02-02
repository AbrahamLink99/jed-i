import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function RootCauseTable({ data, title }) {
  const [selectedCause, setSelectedCause] = useState(null);

  const trendIcon = {
    up: <TrendingUp className="w-3 h-3" />,
    down: <TrendingDown className="w-3 h-3" />,
    neutral: <Minus className="w-3 h-3" />
  };

  const trendColor = {
    up: 'text-red-600',
    down: 'text-green-600',
    neutral: 'text-slate-500'
  };

  return (
    <>
      <div className="analytics-card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
        
        <div className="space-y-2">
          {data.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setSelectedCause(item)}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-cyan-600 hover:bg-cyan-50/50 transition-all group"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-sm">
                  {index + 1}
                </div>
                
                <div className="text-left flex-1">
                  <div className="font-medium text-slate-900">{item.cause}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.count} händelser</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{item.percentage}%</div>
                  <div className={cn('flex items-center gap-1 justify-end mt-1', trendColor[item.trend])}>
                    {trendIcon[item.trend]}
                    <span className="text-xs font-medium">
                      {item.trend === 'up' ? 'Ökar' : item.trend === 'down' ? 'Minskar' : 'Stabil'}
                    </span>
                  </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-600 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drill-down Modal */}
      <Dialog open={!!selectedCause} onOpenChange={() => setSelectedCause(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedCause?.cause}</span>
              <Badge variant="secondary" className="text-base">
                {selectedCause?.percentage}% av alla problem
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-slate-900">{selectedCause?.count}</div>
                  <div className="text-xs text-slate-600 mt-1">Händelser (30d)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{selectedCause?.percentage}%</div>
                  <div className="text-xs text-slate-600 mt-1">Andel av totalt</div>
                </div>
                <div>
                  <div className={cn('text-2xl font-bold', trendColor[selectedCause?.trend || 'neutral'])}>
                    {selectedCause?.trend === 'up' ? '↑' : selectedCause?.trend === 'down' ? '↓' : '→'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Trend</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Exempel på händelser</h4>
              <div className="space-y-2">
                {selectedCause?.examples?.map((example, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{example.product}</div>
                        <div className="text-sm text-slate-600 mt-1">{example.impact}</div>
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap ml-4">
                        {new Date(example.date).toLocaleDateString('sv-SE')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}