import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePermissions, PERMISSIONS, PermissionGate } from '@/components/auth/PermissionGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as AlertDH,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { 
  Shield, Users, FileText, AlertCircle, CheckCircle, 
  UserPlus, Search, Calendar, Hash, Database, Activity, ClipboardList, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import ImportWizard from '@/components/admin/import/ImportWizard';
import InventoryCount from '@/components/admin/InventoryCount';



import SystemGuide from '@/components/admin/SystemGuide';


const roleColors = {
  admin: 'bg-purple-100 text-purple-700',
  production: 'bg-blue-100 text-blue-700',
  warehouse: 'bg-amber-100 text-amber-700',
  purchasing: 'bg-emerald-100 text-emerald-700',
  readonly: 'bg-slate-100 text-slate-700'
};

const roleLabels = {
  admin: 'Administratör',
  production: 'Produktion',
  warehouse: 'Lager',
  purchasing: 'Inköp',
  readonly: 'Endast läsning'
};

const actionTypeColors = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  STATUS_CHANGE: 'bg-amber-100 text-amber-700',
  VOID: 'bg-red-100 text-red-700',
  REVERSAL: 'bg-orange-100 text-orange-700',
  LOGIN: 'bg-slate-100 text-slate-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
  ACKNOWLEDGE: 'bg-emerald-100 text-emerald-700',
  INTEGRATION_CALL: 'bg-purple-100 text-purple-700'
};

export default function AdminPage() {
  const { user, hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('readonly');
  const [purging, setPurging] = useState(false);
  const [auditFilter, setAuditFilter] = useState({
    actionType: 'all',
    entityType: 'all',
    actor: 'all'
  });

  const queryClient = useQueryClient();



  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: hasPermission(PERMISSIONS.USERS_MANAGE)
  });

  // Fetch audit logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLogEntry.list('-created_date', 100),
    enabled: hasPermission(PERMISSIONS.AUDITLOG_READ)
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      await base44.users.inviteUser(email, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('readonly');
      toast.success('Inbjudan skickad');
    },
    onError: (error) => {
      toast.error('Kunde inte skicka inbjudan: ' + error.message);
    }
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      await base44.entities.User.update(userId, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Användarroll uppdaterad');
    }
  });

  const handlePurge = async () => {
    setPurging(true);
    try {
      const entities = ['Product','MixBatch','FinishedBatch','FillingReport','PackagingRecipe','InventoryAlert','Batch','PlanningScenario','InventoryLedger','BOMItem','BatchLot'];
      let totalDeleted = 0;
      for (const name of entities) {
        try {
          while (true) {
            const batch = await base44.entities[name].filter({ environment: 'sandbox' }, 'id', 100);
            if (!batch || batch.length === 0) break;
            for (const rec of batch) {
              await base44.entities[name].delete(rec.id);
              totalDeleted++;
            }
          }
        } catch (e) {
          console.warn('Purge skip for', name, e?.message || e);
        }
      }
      if (totalDeleted > 0) {
        toast.success(`Rensade ${totalDeleted} sandbox-poster`);
      } else {
        toast.success('Inga sandbox-poster hittades');
      }
      queryClient.invalidateQueries();
    } finally {
      setPurging(false);
    }
  };

  // Check audit log integrity
  const checkAuditIntegrity = () => {
    let isValid = true;
    const sortedLogs = [...auditLogs].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (let i = 1; i < sortedLogs.length; i++) {
      const current = sortedLogs[i];
      const previous = sortedLogs[i - 1];
      
      if (current.prev_hash !== previous.entry_hash) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      toast.success('Audit-loggen är intakt ✓');
    } else {
      toast.error('⚠️ Audit-loggen har manipulerats!');
    }
  };

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditFilter.actionType !== 'all' && log.action_type !== auditFilter.actionType) return false;
    if (auditFilter.entityType !== 'all' && log.entity_type !== auditFilter.entityType) return false;
    if (auditFilter.actor !== 'all' && log.actor_email !== auditFilter.actor) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return log.summary_message?.toLowerCase().includes(search) ||
             log.actor_email?.toLowerCase().includes(search);
    }
    return true;
  });

  // Get unique values for filters
  const uniqueActionTypes = [...new Set(auditLogs.map(l => l.action_type))];
  const uniqueEntityTypes = [...new Set(auditLogs.map(l => l.entity_type))];
  const uniqueActors = [...new Set(auditLogs.map(l => l.actor_email))];

  if (!hasPermission(PERMISSIONS.USERS_MANAGE) && !hasPermission(PERMISSIONS.AUDITLOG_READ)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Du har inte behörighet att komma åt adminpanelen.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#80b49c]" />
            Adminpanel
          </h1>
          <p className="text-slate-500 mt-1">Hantera användare, roller och audit-logg</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
              <TabsTrigger value="users">
                <Users className="w-4 h-4 mr-2" />
                Användare
              </TabsTrigger>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
              <TabsTrigger value="import">
                <Database className="w-4 h-4 mr-2" />
                Import
              </TabsTrigger>
            </PermissionGate>

            <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
              <TabsTrigger value="inventory">
                <ClipboardList className="w-4 h-4 mr-2" />
                Inventering
              </TabsTrigger>
            </PermissionGate>

            <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
              <TabsTrigger value="guide">
                <FileText className="w-4 h-4 mr-2" />
                Guide
              </TabsTrigger>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.AUDITLOG_READ}>
              <TabsTrigger value="audit">
                <FileText className="w-4 h-4 mr-2" />
                Audit-logg
              </TabsTrigger>
            </PermissionGate>
          </TabsList>

          {/* Users Tab */}
          <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Användare</CardTitle>
                      <CardDescription>Hantera användare och deras roller</CardDescription>
                    </div>
                    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Bjud in användare
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Bjud in ny användare</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>E-postadress</Label>
                            <Input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="namn@exempel.se"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Roll</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administratör</SelectItem>
                                <SelectItem value="production">Produktion</SelectItem>
                                <SelectItem value="warehouse">Lager</SelectItem>
                                <SelectItem value="purchasing">Inköp</SelectItem>
                                <SelectItem value="readonly">Endast läsning</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={() => inviteUserMutation.mutate({ email: inviteEmail, role: inviteRole })}
                            disabled={!inviteEmail || inviteUserMutation.isPending}
                            className="w-full"
                          >
                            {inviteUserMutation.isPending ? 'Skickar...' : 'Skicka inbjudan'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Namn</TableHead>
                        <TableHead>E-post</TableHead>
                        <TableHead>Roll</TableHead>
                        <TableHead>Skapad</TableHead>
                        <TableHead className="text-right">Åtgärder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((usr) => (
                        <TableRow key={usr.id}>
                          <TableCell className="font-medium">{usr.full_name || '-'}</TableCell>
                          <TableCell>{usr.email}</TableCell>
                          <TableCell>
                            <Badge className={cn(roleColors[usr.role] || roleColors.readonly, "font-normal")}>
                              {roleLabels[usr.role] || 'Okänd'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {usr.created_date && format(new Date(usr.created_date), 'd MMM yyyy', { locale: sv })}
                          </TableCell>
                          <TableCell className="text-right">
                            {usr.id !== user?.id && (
                              <Select
                                value={usr.role || 'readonly'}
                                onValueChange={(newRole) => updateRoleMutation.mutate({ userId: usr.id, newRole })}
                              >
                                <SelectTrigger className="w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="production">Produktion</SelectItem>
                                  <SelectItem value="warehouse">Lager</SelectItem>
                                  <SelectItem value="purchasing">Inköp</SelectItem>
                                  <SelectItem value="readonly">Läsning</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {usr.id === user?.id && (
                              <span className="text-sm text-slate-500">(Du själv)</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </PermissionGate>

          {/* Import Tab */}
          <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
            <TabsContent value="import" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Import</h2>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={purging}>
                      <Trash2 className="w-4 h-4" /> {purging ? 'Rensar...' : 'Rensa testdata'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDH>
                      <AlertDialogTitle>Rensa testdata (sandbox)</AlertDialogTitle>
                      <AlertDialogDescription>
                        Detta tar bort ALLA poster märkta som environment = 'sandbox' i hela systemet. Åtgärden går inte att ångra.
                      </AlertDialogDescription>
                    </AlertDH>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePurge} className="bg-red-600 hover:bg-red-700">
                        Jag förstår, rensa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <ImportWizard />
            </TabsContent>
          </PermissionGate>



          {/* Inventory Count Tab */}
          <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
            <TabsContent value="inventory">
              <InventoryCount />
            </TabsContent>
          </PermissionGate>



          {/* System Guide Tab */}
          <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
            <TabsContent value="guide">
              <SystemGuide />
            </TabsContent>
          </PermissionGate>

          {/* Audit Log Tab */}
          <PermissionGate permission={PERMISSIONS.AUDITLOG_READ}>
            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Audit-logg</CardTitle>
                      <CardDescription>Oföränderlig logg över alla systemhändelser</CardDescription>
                    </div>
                    <Button variant="outline" onClick={checkAuditIntegrity}>
                      <Hash className="w-4 h-4 mr-2" />
                      Kontrollera integritet
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Sök i logg..."
                        className="pl-10"
                      />
                    </div>
                    <Select
                      value={auditFilter.actionType}
                      onValueChange={(v) => setAuditFilter({ ...auditFilter, actionType: v })}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Typ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla typer</SelectItem>
                        {uniqueActionTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={auditFilter.entityType}
                      onValueChange={(v) => setAuditFilter({ ...auditFilter, entityType: v })}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Entitet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla entiteter</SelectItem>
                        {uniqueEntityTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Audit Log Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tidpunkt</TableHead>
                          <TableHead>Användare</TableHead>
                          <TableHead>Åtgärd</TableHead>
                          <TableHead>Beskrivning</TableHead>
                          <TableHead>Sida</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAuditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-slate-500 font-mono">
                              {log.timestamp && format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: sv })}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm">{log.actor_email}</span>
                                <Badge className={cn(roleColors[log.actor_role], "font-normal w-fit")}>
                                  {roleLabels[log.actor_role]}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(actionTypeColors[log.action_type], "font-normal")}>
                                {log.action_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm">{log.summary_message}</span>
                                {log.entity_type && (
                                  <span className="text-xs text-slate-500">
                                    {log.entity_type} {log.entity_id && `#${log.entity_id.slice(0, 8)}`}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {log.page_context || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredAuditLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                              <p>Inga händelser hittades</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </PermissionGate>
        </Tabs>
      </div>
    </div>
  );
}