import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, Users, UserCheck, UserX, DollarSign, Settings as SettingsIcon, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import { usePresence } from "@/hooks/usePresence";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CreateWorkerDialog from "@/components/workers/CreateWorkerDialog";
import { PermissionButton, PermissionGate } from "@/components/permissions";

interface Worker {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  phone: string | null;
  worker_state: string | null;
  is_active: boolean;
  pay_rate_category: {
    name: string;
    hourly_rate: number;
  } | null;
}

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onlineUsers, updateCursorPosition } = usePresence({ page: "workers-page" });

  const updateCursor = (e: React.MouseEvent) => {
    updateCursorPosition(e.clientX, e.clientY);
  };

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      // Get all user_roles with worker role
      const { data: workerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      if (rolesError) throw rolesError;
      
      const workerUserIds = workerRoles?.map(r => r.user_id) || [];
      
      if (workerUserIds.length === 0) return [];

      // Fetch profiles for those users (now includes email)
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          worker_state,
          is_active,
          pay_rate_category:pay_rate_categories(name, hourly_rate)
        `)
        .in("id", workerUserIds)
        .order("first_name");

      if (error) throw error;
      return (profiles || []) as Worker[];
    },
  });

  const filteredWorkers = workers.filter((worker) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${worker.first_name || ""} ${worker.last_name || ""}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      worker.email?.toLowerCase().includes(searchLower) ||
      worker.phone?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: workers.length,
    active: workers.filter((w) => w.is_active).length,
    inactive: workers.filter((w) => !w.is_active).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" onMouseMove={updateCursor}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workers</h1>
            <p className="text-muted-foreground">Manage your workforce and their details</p>
          </div>
          <div className="flex items-center gap-2">
            <PresenceIndicator users={onlineUsers} />
            <PermissionButton
              module="workers"
              permission="create"
              onClick={() => setShowCreateDialog(true)}
              hideIfNoPermission={true}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create New Worker
            </PermissionButton>
            <Button onClick={() => navigate("/settings")} variant="outline">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
          </div>
        </div>

        {workers.length === 0 && !isLoading && (
          <Alert>
            <AlertDescription>
              No workers found. To add workers, go to <strong>Settings → Users</strong> and enable the "Is Worker" checkbox for user accounts.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Rate</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(
                  workers
                    .filter((w) => w.pay_rate_category?.hourly_rate)
                    .reduce((sum, w) => sum + (w.pay_rate_category?.hourly_rate || 0), 0) /
                  workers.filter((w) => w.pay_rate_category?.hourly_rate).length || 0
                ).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search workers..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Pay Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => (
                    <TableRow
                      key={worker.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/workers/${worker.id}`)}
                    >
                      <TableCell className="font-medium">
                        {worker.first_name} {worker.last_name}
                      </TableCell>
                      <TableCell>{worker.email}</TableCell>
                      <TableCell>{worker.phone || "-"}</TableCell>
                      <TableCell>{worker.worker_state || "-"}</TableCell>
                      <TableCell>
                        {worker.pay_rate_category ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{worker.pay_rate_category.name}</span>
                            <span className="text-sm text-muted-foreground">
                              ${worker.pay_rate_category.hourly_rate}/hr
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={worker.is_active ? "default" : "secondary"}>
                          {worker.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/workers/${worker.id}`);
                            }}>
                              View Details
                            </DropdownMenuItem>
                            <PermissionGate module="workers" permission="delete">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to remove worker access? This will remove the worker role but keep the user account.")) {
                                    // Remove worker role via user_roles
                                    supabase
                                      .from("user_roles")
                                      .delete()
                                      .eq("user_id", worker.id)
                                      .eq("role", "worker")
                                      .then(() => {
                                        queryClient.invalidateQueries({ queryKey: ["workers"] });
                                        toast.success("Worker access removed");
                                      });
                                  }
                                }}
                                className="text-destructive"
                              >
                                Remove Worker Access
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      <CreateWorkerDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </DashboardLayout>
  );
}
