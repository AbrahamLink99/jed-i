import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import MeticsImport from "../components/admin/MeticsImport";
import DataImport from "../components/admin/DataImport";
import InventoryCount from "../components/admin/InventoryCount";
import SystemGuide from "../components/admin/SystemGuide";
import UsersAdmin from "../components/admin/UsersAdmin";
import AuditLogViewer from "../components/admin/AuditLogViewer";
import ErrorBoundary from "../components/common/ErrorBoundary";

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

  const allowed = user?.role === "admin" || user?.role === "purchasing";

  if (!allowed) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Åtkomst nekad</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Du måste ha rollen Admin eller Purchasing för att komma åt Admin.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin</h1>
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="users">Användare</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="inventory">Inventering</TabsTrigger>
          <TabsTrigger value="guide">Guide</TabsTrigger>
          <TabsTrigger value="metics-bom">Metics BOM</TabsTrigger>
          <TabsTrigger value="audit">Audit-logg</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Användare</div>}>
            <UsersAdmin />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="import">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Import</div>}>
            <DataImport />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="inventory">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Inventering</div>}>
            <InventoryCount />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="guide">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Guide</div>}>
            <SystemGuide />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="metics-bom">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Komponenten kunde inte laddas</div>}>
            <MeticsImport />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="audit">
          <ErrorBoundary fallback={<div className="p-4 border rounded bg-amber-50 text-amber-800">Kunde inte ladda Audit-logg</div>}>
            <AuditLogViewer />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}