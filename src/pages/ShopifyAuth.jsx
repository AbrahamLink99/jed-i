import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const SHOP = 'brunsprofessional.myshopify.com';
const SCOPES = 'read_orders,read_products,read_inventory';
const REDIRECT_URI = 'https://jed-i.base44.app/ShopifyAuth';

function generateNonce() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function ShopifyAuth() {
  const [status, setStatus] = useState('idle'); // idle | exchanging | success | error
  const [accessToken, setAccessToken] = useState('');
  const [scope, setScope] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const savedState = sessionStorage.getItem('shopify_oauth_state');

    if (code) {
      if (state !== savedState) {
        setStatus('error');
        setError('Ogiltig state-parameter. Försök igen.');
        return;
      }
      sessionStorage.removeItem('shopify_oauth_state');
      // Clean URL
      window.history.replaceState({}, '', '/ShopifyAuth');
      exchangeCode(code);
    }
  }, []);

  async function exchangeCode(code) {
    setStatus('exchanging');
    try {
      const res = await base44.functions.invoke('shopifyOAuthCallback', { code });
      const data = res.data;
      if (data.error) throw new Error(data.error);
      setAccessToken(data.access_token);
      setScope(data.scope);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  function startOAuth() {
    const nonce = generateNonce();
    sessionStorage.setItem('shopify_oauth_state', nonce);
    const url = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${nonce}`;
    window.location.href = url;
  }

  function copyToken() {
    navigator.clipboard.writeText(accessToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>
          Shopify OAuth
        </h1>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Cormorant', serif", fontStyle: 'italic', fontSize: 16 }}>
          Hämta access token för brunsprofessional.myshopify.com
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 15, color: 'var(--text-primary)' }}>
            {SHOP}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {status === 'idle' && (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Klicka nedan för att auktorisera appen i Shopify och hämta en <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>shpat_...</code>-token.
              </p>
              <div style={{ background: 'var(--panel-hover)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Scopes:</strong> {SCOPES}
              </div>
              <Button onClick={startOAuth} style={{ background: 'var(--text-primary)', color: 'var(--text-on-dark)', borderRadius: 50 }} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Auktorisera med Shopify
              </Button>
            </>
          )}

          {status === 'exchanging' && (
            <div className="flex items-center gap-3 py-4" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Byter kod mot access token...</span>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2" style={{ color: '#3D5C42' }}>
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Auktorisering lyckades!</span>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Access Token
                </div>
                <div style={{ background: 'var(--panel-hover)', borderRadius: 8, padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, wordBreak: 'break-all', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  {accessToken}
                </div>
              </div>
              {scope && (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                  <strong>Scopes:</strong> {scope}
                </div>
              )}
              <Button onClick={copyToken} variant="outline" className="rounded-full">
                {copied ? '✓ Kopierad!' : 'Kopiera token'}
              </Button>
              <div style={{ background: 'rgba(196,98,45,0.08)', border: '1px solid rgba(196,98,45,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--accent)' }}>
                <strong>Nästa steg:</strong> Gå till Base44 Dashboard → Settings → Secrets och uppdatera <code style={{ fontFamily: "'IBM Plex Mono', monospace" }}>SHOPIFY_ACCESS_TOKEN</code> med värdet ovan.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2" style={{ color: 'var(--red-alert)' }}>
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">Fel uppstod</span>
              </div>
              <div style={{ background: 'var(--red-muted)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red-alert)' }}>
                {error}
              </div>
              <Button onClick={() => setStatus('idle')} variant="outline" className="rounded-full">
                Försök igen
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}