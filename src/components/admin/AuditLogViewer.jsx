import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AuditLogViewer() {
  const [entries, setEntries] = React.useState([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await base44.entities.AuditLogEntry.list("-created_date", 100);
        if (mounted) setEntries(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error("Failed to load audit log", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit-logg</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tid</TableHead>
                <TableHead>Användare</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Entitet</TableHead>
                <TableHead>Sammanfattning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-slate-500">{new Date(e.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{e.actor_email}</TableCell>
                  <TableCell><Badge variant="secondary">{e.actor_role}</Badge></TableCell>
                  <TableCell>{e.action_type}</TableCell>
                  <TableCell>{e.entity_type}</TableCell>
                  <TableCell className="max-w-[420px] truncate" title={e.summary_message}>{e.summary_message}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">Ingen logg hittad</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}