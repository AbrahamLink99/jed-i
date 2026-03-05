import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import MeticsImport from "../components/admin/MeticsImport";

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
      <Tabs defaultValue="metics-bom" className="w-full">
        <TabsList>
          <TabsTrigger value="metics-bom">Metics BOM</TabsTrigger>
        </TabsList>
        <TabsContent value="metics-bom">
          <MeticsImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}