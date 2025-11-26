import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserPlus, Shield, AlertCircle } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

const UserManagement = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<{ userId: string; role: string; userName: string } | null>(null);
  const [removeRoleConfirmation, setRemoveRoleConfirmation] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: teams } = useQuery({
    queryKey: ["teams", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("tenant_id", profile.tenant_id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      // Call edge function to get users with emails
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-tenant-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch users');
      }

      const { users: usersData } = await response.json();
      
      // Fetch user teams
      const { data: userTeams } = await supabase
        .from("user_teams")
        .select("user_id, team_id, teams(name)")
        .eq("tenant_id", profile!.tenant_id);

      // Combine users with their teams
      const usersWithTeams = (usersData || []).map((user: any) => ({
        ...user,
        teams: userTeams
          ?.filter((ut) => ut.user_id === user.id)
          .map((ut) => ({ id: ut.team_id, name: ut.teams?.name })) || [],
      }));

      return usersWithTeams;
    },
    enabled: !!profile?.tenant_id && isAdmin,
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!profile?.tenant_id) throw new Error("No tenant ID");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: role as any,
          tenant_id: profile.tenant_id,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role assigned successfully");
      setIsDialogOpen(false);
      setSelectedUserId(null);
      setSelectedRole("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign role");
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // Check if this is a critical admin role
      if (role === 'tenant_admin' || role === 'super_admin') {
        // Count how many users have this role
        const { data: roleCount, error: countError } = await supabase
          .from("user_roles")
          .select("id", { count: 'exact' })
          .eq("role", role as any)
          .eq("tenant_id", profile!.tenant_id);

        if (countError) throw countError;

        if ((roleCount?.length || 0) <= 1) {
          throw new Error(`Cannot remove the last ${role} role. Assign this role to another user first.`);
        }
      }

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role removed successfully");
      setRoleToRemove(null);
      setRemoveRoleConfirmation("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove role");
      setRoleToRemove(null);
      setRemoveRoleConfirmation("");
    },
  });

  const assignTeamMutation = useMutation({
    mutationFn: async ({ userId, teamId }: { userId: string; teamId: string }) => {
      const { error } = await supabase
        .from("user_teams")
        .insert({
          user_id: userId,
          team_id: teamId,
          tenant_id: profile!.tenant_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Team assigned successfully");
      setShowTeamDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign team");
    },
  });

  const removeTeamMutation = useMutation({
    mutationFn: async ({ userId, teamId }: { userId: string; teamId: string }) => {
      const { error } = await supabase
        .from("user_teams")
        .delete()
        .eq("user_id", userId)
        .eq("team_id", teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Team removed successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove team");
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-user-status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, isActive }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle user status');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(
        variables.isActive 
          ? "User activated successfully" 
          : "User deactivated and all sessions terminated"
      );
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to toggle user status");
    },
  });

  const handleAssignRole = () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    assignRoleMutation.mutate({ userId: selectedUserId, role: selectedRole });
  };

  const handleAssignTeam = () => {
    if (selectedUserId && selectedTeamId) {
      assignTeamMutation.mutate({
        userId: selectedUserId,
        teamId: selectedTeamId,
      });
      setSelectedTeamId("");
    }
  };

  const handleRemoveRoleClick = (userId: string, role: string, userName: string) => {
    setRoleToRemove({ userId, role, userName });
  };

  const handleConfirmRemoveRole = () => {
    if (!roleToRemove) return;

    const expectedConfirmation = roleToRemove.role.toUpperCase();
    if (removeRoleConfirmation.trim() !== expectedConfirmation) {
      toast.error(`Please type "${expectedConfirmation}" to confirm`);
      return;
    }

    removeRoleMutation.mutate({
      userId: roleToRemove.userId,
      role: roleToRemove.role,
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "tenant_admin":
        return "destructive";
      case "management":
        return "destructive";
      case "supervisor":
        return "default";
      case "worker":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <AlertCircle className="h-16 w-16 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              You don't have permission to access user management.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              Manage users, roles, and access control
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Role to User</DialogTitle>
                <DialogDescription>
                  Select a user and assign them a role
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">User</label>
                  <Select value={selectedUserId || ""} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAssignRole} className="w-full">
                  Assign Role
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              All users in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div>Loading...</div>
            ) : (
              <Table>
                 <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">{user.first_name} {user.last_name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.user_roles && user.user_roles.length > 0 ? (
                            user.user_roles.map((ur: any, idx: number) => (
                              <Badge
                                key={idx}
                                variant={getRoleBadgeVariant(ur.role)}
                                className="cursor-pointer hover:opacity-80"
                                onClick={() =>
                                  handleRemoveRoleClick(
                                    user.id,
                                    ur.role,
                                    `${user.first_name} ${user.last_name}`
                                  )
                                }
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                {ur.role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap items-center">
                          {user.teams && user.teams.length > 0 ? (
                            user.teams.map((team: any) => (
                              <Badge
                                key={team.id}
                                variant="secondary"
                                className="cursor-pointer hover:opacity-80"
                                onClick={() =>
                                  removeTeamMutation.mutate({
                                    userId: user.id,
                                    teamId: team.id,
                                  })
                                }
                              >
                                {team.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">No teams</span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setShowTeamDialog(true);
                            }}
                          >
                            +
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={user.is_active ? "default" : "secondary"}
                            className="min-w-[80px] justify-center"
                          >
                            {user.is_active ? "Active" : "Deactivated"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Label htmlFor={`status-${user.id}`} className="text-xs text-muted-foreground cursor-pointer">
                            {user.is_active ? "Deactivate" : "Activate"}
                          </Label>
                          <Switch
                            id={`status-${user.id}`}
                            checked={user.is_active}
                            onCheckedChange={(checked) => {
                              toggleUserStatusMutation.mutate({
                                userId: user.id,
                                isActive: checked,
                              });
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Team</DialogTitle>
            <DialogDescription>
              Assign a team to this user to define their workflow and module access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team">Select Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams?.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssignTeam} className="w-full">
              Assign Team
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={!!roleToRemove} 
        onOpenChange={(open) => {
          if (!open) {
            setRoleToRemove(null);
            setRemoveRoleConfirmation("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Role</DialogTitle>
            <DialogDescription>
              This action will remove the <strong className="text-foreground">{roleToRemove?.role}</strong> role from{" "}
              <strong className="text-foreground">{roleToRemove?.userName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(roleToRemove?.role === 'tenant_admin' || roleToRemove?.role === 'super_admin') && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Warning: This is a critical admin role. Make sure another user has this role before removing.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="confirmRole">
                Type <strong className="text-foreground">{roleToRemove?.role.toUpperCase()}</strong> to confirm
              </Label>
              <Input
                id="confirmRole"
                value={removeRoleConfirmation}
                onChange={(e) => setRemoveRoleConfirmation(e.target.value)}
                placeholder={`Type ${roleToRemove?.role.toUpperCase()} here`}
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRoleToRemove(null);
                  setRemoveRoleConfirmation("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmRemoveRole}
                disabled={removeRoleConfirmation.trim() !== roleToRemove?.role.toUpperCase()}
              >
                Remove Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UserManagement;
