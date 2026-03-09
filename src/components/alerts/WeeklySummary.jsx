import React, { useEffect, useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function WeeklySummary() {
  const [analysis, setAnalysis] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const runAnalysis = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('weeklySummary', {});
      const data = res?.data;
      if (data?.error) {
        const msg = data.details ? `${data.error}: ${data.details}` : data.error;
        setError(`Fel från AI: ${msg}`);
        console.error('weeklySummary error payload:', data);
        return;
      }
      // Try to parse if string (shouldn't happen but guard it)
      let parsed = data;
      if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data);
        } catch (parseErr) {
          console.error('AI-svar kunde inte tolkas (råtext):', data);
          setError('AI-svaret kunde inte tolkas – se konsolen för detaljer.');
          return;
        }
      }
      setAnalysis(parsed || null);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Okänt fel';
      setError(`Kunde inte hämta analysen: ${msg}`);
      console.error('weeklySummary fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const produce = Array.isArray(analysis?.produce_this_week) ? analysis.produce_this_week : [];
  const orderNow = Array.isArray(analysis?.order_now) ? analysis.order_now : [];
  const orderSoon = Array.isArray(analysis?.order_soon) ? analysis.order_soon : [];
  const insights = typeof analysis?.insights === 'string' ? analysis.insights : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Veckans åtgärder</h2>
        <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading}>
          {loading ? 'Analyserar…' : 'Uppdatera analys'}
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-4 text-slate-600">AI analyserar ditt lager...</CardContent>
        </Card>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card style={{ borderLeft: '6px solid #E8F02A' }}>
            <CardHeader>
              <CardTitle className="text-slate-900">Tillverka denna vecka</CardTitle>
            </CardHeader>
            <CardContent>
              {produce.length === 0 ? (
                <p className="text-sm text-slate-500">Inga specifika rekommendationer.</p>
              ) : (
                <ul className="space-y-2">
                  {produce.map((p, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{p.sku}</span> – {p.name}
                      {p.reason && <span className="text-slate-600"> • {p.reason}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card style={{ borderLeft: '6px solid #E53E3E' }}>
            <CardHeader>
              <CardTitle className="text-slate-900">Beställ nu</CardTitle>
            </CardHeader>
            <CardContent>
              {orderNow.length === 0 ? (
                <p className="text-sm text-slate-500">Inget akut att beställa.</p>
              ) : (
                <div className="space-y-4">
                  {orderNow.map((grp, gi) => (
                    <div key={gi}>
                      <div className="text-sm font-semibold">{grp.supplier || 'Okänd leverantör'}</div>
                      {grp.reason && <div className="text-xs text-slate-500 mb-1">{grp.reason}</div>}
                      <ul className="text-sm space-y-1">
                        {(grp.items || []).map((it, ii) => (
                          <li key={ii}>
                            <span className="font-medium">{it.sku}</span> – {it.name}
                            {it.qty && (
                              <span className="text-slate-700"> • {it.qty}{it.unit ? ` ${it.unit}` : ''}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card style={{ borderLeft: '6px solid #F4833D' }}>
            <CardHeader>
              <CardTitle className="text-slate-900">Beställ snart</CardTitle>
            </CardHeader>
            <CardContent>
              {orderSoon.length === 0 ? (
                <p className="text-sm text-slate-500">Inget att förbereda just nu.</p>
              ) : (
                <div className="space-y-4">
                  {orderSoon.map((grp, gi) => (
                    <div key={gi}>
                      <div className="text-sm font-semibold">{grp.supplier || 'Okänd leverantör'}</div>
                      {grp.reason && <div className="text-xs text-slate-500 mb-1">{grp.reason}</div>}
                      <ul className="text-sm space-y-1">
                        {(grp.items || []).map((it, ii) => (
                          <li key={ii}>
                            <span className="font-medium">{it.sku}</span> – {it.name}
                            {it.qty && (
                              <span className="text-slate-700"> • {it.qty}{it.unit ? ` ${it.unit}` : ''}</span>
                            )}
                            {grp.connected_to && (
                              <span className="text-slate-500"> (kopplat till {grp.connected_to})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {insights && (
        <p className="text-sm italic text-slate-500">{insights}</p>
      )}
    </div>
  );
}