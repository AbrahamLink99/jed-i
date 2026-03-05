import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function UsersAdmin() {
  const [users, setUsers] = React.useState([]);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await base44.entities.User.list("-created_date", 100);
        if (mounted) setUsers(Array.isArray(list) ? list : []);
      } catch (e) {
        console.warn("Could not list users (admin only)", e);
        if (mounted) setError("Endast admin kan visa användare.");
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Användare</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded">{error}</div>
        ) : (
          <div className="overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Skapad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{u.email}</TableCell>
                    <TableCell>{u.role || "user"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{new Date(u.created_date).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">Inga användare</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}