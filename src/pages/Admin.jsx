import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ErrorBoundary from "../components/common/ErrorBoundary";
const UsersAdmin = React.lazy(() => import("../components/admin/UsersAdmin"));
const DataImport = React.lazy(() => import("../components/admin/DataImport"));
const InventoryCount = React.lazy(() => import("../components/admin/InventoryCount"));
const SystemGuide = React.lazy(() => import("../components/admin/SystemGuide"));
const MeticsImport = React.lazy(() => import("../components/admin/MeticsImport"));
const AuditLogViewer = React.lazy(() => import("../components/admin/AuditLogViewer"));
const SalesImport = React.lazy(() => import("../components/admin/SalesImport"));

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await base44.auth.me();
        if (mounted) setUser(u || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 w-40 bg-slate-200 rounded" />
      </div>
    );
  }

  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'users';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin</h1>
      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="users">Användare</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="inventory">Inventering</TabsTrigger>
          <TabsTrigger value="guide">Guide</TabsTrigger>
          <TabsTrigger value="metics-bom">Metics BOM</TabsTrigger>
          <TabsTrigger value="audit">Audit-logg</TabsTrigger>
          <TabsTrigger value="sales">Försäljning</TabsTrigger>
          <Link to={createPageUrl('ShopifyAuth')} style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--accent)', fontWeight: 600, padding: '5px 10px', whiteSpace: 'nowrap' }}>
            🔑 Shopify OAuth
          </Link>
          </TabsList>

        <TabsContent value="users">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Användare</div>}>
            <React.Suspense fallback={<div className="p-4">Laddar...</div>}>
              <UsersAdmin />
            </React.Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="import">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Import</div>}>
            <React.Suspense fallback={<div className="p-4">Laddar...</div>}>
              <DataImport />
            </React.Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="inventory">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Inventering</div>}>
            <React.Suspense fallback={<div className="p-4">Laddar...</div>}>
              <InventoryCount />
            </React.Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="guide">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Guide</div>}>
            <React.Suspense fallback={<div className="p-4">Laddar...</div>}>
              <SystemGuide />
            </React.Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="metics-bom">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Komponenten kunde inte laddas</div>}>
            <React.Suspense fallback={<div className="p-4">Laddar...</div>}>
              <MeticsImport />
            </React.Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="audit">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Audit-logg</div>}>
            <React.Suspense fallback={<div className="p-4">Laddar...</div>}>
              <AuditLogViewer />
            </React.Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="sales">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Försäljning</div>}>
            <React.Suspense fallback={<div className="p-4">Laddar...</div>}>
              <SalesImport />
            </React.Suspense>
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}