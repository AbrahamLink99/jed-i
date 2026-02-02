import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';

export default function ShopifyConnection() {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    loadConnection();
  }, []);

  const loadConnection = async () => {
    try {
      const connections = await base44.entities.ShopifyConnection.filter({ status: 'installed' });
      if (connections.length > 0) {
        setConnection(connections[0]);
      }
    } catch (error) {
      console.error('Failed to load connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    const shop = prompt('Ange din Shopify-butik (t.ex. din-butik.myshopify.com):');
    if (!shop || shop.trim() === '') {
      alert('Du måste ange en butiksdomain');
      return;
    }
    
    const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;
    window.location.href = `/api/functions/shopifyOAuthStart?shop=${encodeURIComponent(shopDomain)}`;
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await base44.functions.invoke('shopifyInventorySync');
      setSyncResult(response.data);
      await loadConnection(); // Refresh connection to show updated last_sync_at
    } catch (error) {
      setSyncResult({ error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="text-slate-600">Laddar...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Shopify-anslutning
          {connection ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Ansluten
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-600">
              <XCircle className="w-3 h-3 mr-1" />
              Ej ansluten
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          JED-I är single source of truth. Synka lager från Base44 till Shopify.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {connection ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Butik:</span>
                <span className="font-medium">{connection.shop_domain}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Installerad:</span>
                <span className="font-medium">
                  {new Date(connection.installed_at).toLocaleDateString('sv-SE')}
                </span>
              </div>
              {connection.last_sync_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Senaste synk:</span>
                  <span className="font-medium">
                    {new Date(connection.last_sync_at).toLocaleString('sv-SE')}
                  </span>
                </div>
              )}
            </div>

            {syncResult && (
              <Alert className={syncResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                <AlertDescription>
                  {syncResult.error ? (
                    <span className="text-red-800">Fel: {syncResult.error}</span>
                  ) : (
                    <span className="text-green-800">
                      Synkade {syncResult.updated} produkter ({syncResult.errors} fel)
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <Alert>
            <AlertDescription>
              För att ansluta Shopify:
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Skapa en Custom app i Shopify Admin</li>
                <li>Lägg till callback URL: <code className="bg-slate-100 px-1">https://jed-i.base44.app/api/functions/shopifyOAuthCallback</code></li>
                <li>Klicka "Anslut Shopify" nedan</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {connection ? (
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Synkar...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Synka lager nu
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleConnect} className="bg-cyan-600 hover:bg-cyan-700">
            <ExternalLink className="w-4 h-4 mr-2" />
            Anslut Shopify
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}