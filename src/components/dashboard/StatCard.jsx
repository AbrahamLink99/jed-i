import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendLabel,
  variant = 'default',
  onClick 
}) {
  const variants = {
    default: 'bg-white border-slate-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
    success: 'bg-emerald-50 border-emerald-200'
  };

  const iconVariants = {
    default: 'bg-slate-100 text-slate-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-red-100 text-red-600',
    success: 'bg-emerald-100 text-emerald-600'
  };

  return (
    <Card 
      className={cn(
        "p-5 border transition-all",
        variants[variant],
        onClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-sm",
              trend >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
              {trendLabel && <span className="text-slate-500">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("p-3 rounded-xl", iconVariants[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}