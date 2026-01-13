import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, AlertTriangle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from "@/lib/utils";

export default function PurchaseSuggestions({ suggestions = [], onViewAll }) {
  if (suggestions.length === 0) {
    return (
      <Card className="p-6 border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-4">Inköpsförslag</h3>
        <div className="text-center py-8 text-slate-500">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Inga inköp behövs just nu</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Inköpsförslag</h3>
        <Badge variant="outline" className="text-slate-500">
          {suggestions.length} artiklar
        </Badge>
      </div>
      <div className="space-y-3">
        {suggestions.slice(0, 4).map((suggestion, index) => (
          <div 
            key={index}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              suggestion.urgency === 'critical' 
                ? 'bg-red-50 border-red-200' 
                : 'bg-slate-50 border-slate-200'
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {suggestion.urgency === 'critical' && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium text-slate-900">
                  {suggestion.productSku}
                </span>
              </div>
              <p className="text-sm text-slate-500 truncate">
                {suggestion.productName}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="font-semibold text-slate-900">
                {suggestion.suggestedQuantity?.toLocaleString('sv-SE')}
              </p>
              <p className="text-xs text-slate-500">
                Senast {format(new Date(suggestion.orderByDate), 'd MMM', { locale: sv })}
              </p>
            </div>
          </div>
        ))}
      </div>
      {onViewAll && (
        <Button 
          variant="ghost" 
          className="w-full mt-4 text-slate-600"
          onClick={onViewAll}
        >
          Visa alla förslag
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </Card>
  );
}