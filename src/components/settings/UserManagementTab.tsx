import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { UserPlus, Shield, KeyRound, ExternalLink, UserRoundPlus, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

export const UserManagementTab = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [showTeamDialog, setShowTeamDialog] = useState(false);

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
    queryKey: ["users-management", profile?.tenant_id],
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

  const toggleWorkerMutation = useMutation({
    mutationFn: async ({ userId, isWorker }: { userId: string; isWorker: boolean }) => {
      if (!profile?.tenant_id) throw new Error("No tenant ID");

      if (isWorker) {
        // Add worker role
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: 'worker' as any,
            tenant_id: profile.tenant_id,
          } as any);

        if (error) throw error;
      } else {
        // Remove worker role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", 'worker' as any)
          .eq("tenant_id", profile.tenant_id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("Worker status updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update worker status");
    },
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
          created_by: user.id,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("Role assigned successfully");
      setIsRoleDialogOpen(false);
      setSelectedUserId(null);
      setSelectedRole("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign role");
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("Role removed successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove role");
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
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
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

  const createUserMutation = useMutation({
    mutationFn: async ({ email, firstName, lastName, password, role }: { 
      email: string; 
      firstName: string; 
      lastName: string; 
      password: string; 
      role?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-tenant-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, firstName, lastName, password, role }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("User created successfully");
      setIsCreateUserDialogOpen(false);
      setNewUserEmail("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserPassword("");
      setNewUserRole("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create user");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, password }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }
    },
    onSuccess: () => {
      toast.success("Password reset successfully");
      setIsResetPasswordDialogOpen(false);
      setResetPasswordUserId(null);
      setNewPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reset password");
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
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("Team assigned successfully");
      setShowTeamDialog(false);
      setSelectedTeamId("");
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
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("Team removed successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove team");
    },
  });

  const handleAssignRole = () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    assignRoleMutation.mutate({ userId: selectedUserId, role: selectedRole });
  };

  const handleCreateUser = () => {
    if (!newUserEmail || !newUserFirstName || !newUserPassword) {
      toast.error("Email, first name, and password are required");
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    createUserMutation.mutate({
      email: newUserEmail,
      firstName: newUserFirstName,
      lastName: newUserLastName,
      password: newUserPassword,
      role: newUserRole || undefined,
    });
  };

  const handleResetPassword = () => {
    if (!resetPasswordUserId || !newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    resetPasswordMutation.mutate({ userId: resetPasswordUserId, password: newPassword });
  };

  const handleAssignTeam = () => {
    if (selectedUserId && selectedTeamId) {
      assignTeamMutation.mutate({
        userId: selectedUserId,
        teamId: selectedTeamId,
      });
    }
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
      <div className="text-center py-8 text-muted-foreground">
        You don't have permission to manage users
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">User Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage users, assign roles, and reset passwords
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserRoundPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={newUserFirstName}
                    onChange={(e) => setNewUserFirstName(e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newUserLastName}
                    onChange={(e) => setNewUserLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Enter secure password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground space-y-1">
                    <span className="block">Password must contain:</span>
                    <span className="block">• At least 12 characters</span>
                    <span className="block">• At least one uppercase letter (A-Z)</span>
                    <span className="block">• At least one lowercase letter (a-z)</span>
                    <span className="block">• At least one number (0-9)</span>
                    <span className="block">• At least one special character (!@#$%^&*)</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Initial Role (Optional)</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role (optional)" />
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
                <Button onClick={handleCreateUser} className="w-full">
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
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
                <Label>User</Label>
                <Select value={selectedUserId || ""} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
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
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead>Is Worker</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.first_name} {user.last_name}
                </TableCell>
                <TableCell>{user.email || "-"}</TableCell>
                <TableCell>{user.phone || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-2 flex-wrap">
                    {user.user_roles && user.user_roles.length > 0 ? (
                      user.user_roles.map((ur: any, idx: number) => (
                        <Badge
                          key={idx}
                          variant={getRoleBadgeVariant(ur.role)}
                          className="cursor-pointer hover:opacity-80"
                          onClick={() =>
                            removeRoleMutation.mutate({
                              userId: user.id,
                              role: ur.role,
                            })
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
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.has_worker_role}
                      onCheckedChange={(checked) => {
                        toggleWorkerMutation.mutate({
                          userId: user.id,
                          isWorker: checked,
                        });
                      }}
                    />
                    {user.has_worker_role && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/workers/${user.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={user.is_active ? "default" : "secondary"}
                      className="min-w-[90px] justify-center"
                    >
                      {user.is_active ? "Active" : "Deactivated"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`status-${user.id}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResetPasswordUserId(user.id);
                        setIsResetPasswordDialogOpen(true);
                      }}
                      title="Reset Password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Enter a new password for the user (minimum 6 characters)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsResetPasswordDialogOpen(false);
                  setResetPasswordUserId(null);
                  setNewPassword("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleResetPassword}>
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};
