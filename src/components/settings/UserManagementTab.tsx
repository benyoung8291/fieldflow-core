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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Shield, KeyRound, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

export const UserManagementTab = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isWorkerSetupDialogOpen, setIsWorkerSetupDialogOpen] = useState(false);
  const [selectedWorkerUserId, setSelectedWorkerUserId] = useState<string | null>(null);
  const [linkToExisting, setLinkToExisting] = useState(false);
  const [selectedExistingWorkerId, setSelectedExistingWorkerId] = useState<string | null>(null);

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

      const { users } = await response.json();
      return users || [];
    },
    enabled: !!profile?.tenant_id && isAdmin,
  });

  // Fetch existing workers for linking
  const { data: existingWorkers } = useQuery({
    queryKey: ["existing-workers", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true);

      if (error) throw error;

      // Filter to only those with worker role
      const { data: workerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", profile.tenant_id)
        .eq("role", "worker");

      const workerUserIds = new Set(workerRoles?.map(r => r.user_id) || []);
      return data?.filter(p => workerUserIds.has(p.id)) || [];
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

  const handleAssignRole = () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    assignRoleMutation.mutate({ userId: selectedUserId, role: selectedRole });
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

  const setupAsWorkerMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!profile?.tenant_id) throw new Error("No tenant ID");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user already has worker role
      const existingRole = users?.find(u => u.id === userId)?.user_roles?.find((r: any) => r.role === 'worker');
      
      if (existingRole) {
        throw new Error("User already has worker role");
      }

      // Assign worker role
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: 'worker' as any,
          tenant_id: profile.tenant_id,
          created_by: user.id,
        } as any);

      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("Worker profile linked successfully");
      setIsWorkerSetupDialogOpen(false);
      setSelectedWorkerUserId(null);
      // Navigate to worker details to set up profile
      navigate(`/workers/${userId}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to set up worker profile");
    },
  });

  const unlinkWorkerMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", 'worker' as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("Worker profile unlinked successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to unlink worker profile");
    },
  });

  const handleSetupAsWorker = (userId: string) => {
    setSelectedWorkerUserId(userId);
    setLinkToExisting(false);
    setSelectedExistingWorkerId(null);
    setIsWorkerSetupDialogOpen(true);
  };

  const confirmSetupAsWorker = () => {
    if (!selectedWorkerUserId) return;
    
    if (linkToExisting && selectedExistingWorkerId) {
      // Copy worker profile data from existing worker
      linkToExistingWorkerMutation.mutate({
        userId: selectedWorkerUserId,
        existingWorkerId: selectedExistingWorkerId,
      });
    } else {
      // Create new worker profile
      setupAsWorkerMutation.mutate(selectedWorkerUserId);
    }
  };

  const linkToExistingWorkerMutation = useMutation({
    mutationFn: async ({ userId, existingWorkerId }: { userId: string; existingWorkerId: string }) => {
      if (!profile?.tenant_id) throw new Error("No tenant ID");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get existing worker profile data
      const { data: existingProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("pay_rate_category_id, preferred_start_time, preferred_end_time, preferred_days")
        .eq("id", existingWorkerId)
        .single();

      if (fetchError) throw fetchError;

      // Update the new user's profile with worker data
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          pay_rate_category_id: existingProfile.pay_rate_category_id,
          preferred_start_time: existingProfile.preferred_start_time,
          preferred_end_time: existingProfile.preferred_end_time,
          preferred_days: existingProfile.preferred_days,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Assign worker role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: 'worker' as any,
          tenant_id: profile.tenant_id,
          created_by: user.id,
        } as any);

      if (roleError) throw roleError;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("User linked to existing worker profile");
      setIsWorkerSetupDialogOpen(false);
      setSelectedWorkerUserId(null);
      setSelectedExistingWorkerId(null);
      navigate(`/workers/${userId}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link to existing worker");
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "tenant_admin":
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
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
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
              <TableHead>Worker Profile</TableHead>
              <TableHead>Status</TableHead>
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
                  {user.has_worker_role ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/workers/${user.id}`)}
                      >
                        View Profile
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Remove worker profile link?")) {
                            unlinkWorkerMutation.mutate(user.id);
                          }
                        }}
                      >
                        Unlink
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetupAsWorker(user.id)}
                    >
                      Link as Worker
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "default" : "secondary"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResetPasswordUserId(user.id);
                      setIsResetPasswordDialogOpen(true);
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
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

      <Dialog open={isWorkerSetupDialogOpen} onOpenChange={setIsWorkerSetupDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link User as Worker</DialogTitle>
            <DialogDescription>
              Choose to create a new worker profile or link to an existing worker's settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all ${
                  !linkToExisting ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setLinkToExisting(false)}
              >
                <CardHeader>
                  <CardTitle className="text-base">Create New Profile</CardTitle>
                  <CardDescription>
                    Set up worker details from scratch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Custom pay rate</li>
                    <li>• Custom availability</li>
                    <li>• Individual settings</li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all ${
                  linkToExisting ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setLinkToExisting(true)}
              >
                <CardHeader>
                  <CardTitle className="text-base">Link to Existing</CardTitle>
                  <CardDescription>
                    Copy settings from another worker
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Same pay rate</li>
                    <li>• Same availability</li>
                    <li>• Quick setup</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {linkToExisting && (
              <div className="space-y-2">
                <Label>Select Existing Worker</Label>
                <Select value={selectedExistingWorkerId || ""} onValueChange={setSelectedExistingWorkerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a worker to copy settings from" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingWorkers?.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name} {worker.phone && `(${worker.phone})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-md bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                {linkToExisting
                  ? "The user will be assigned the worker role and their profile will be populated with settings from the selected worker."
                  : "The user will be assigned the worker role and you'll be redirected to set up their profile details."}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsWorkerSetupDialogOpen(false);
                  setSelectedWorkerUserId(null);
                  setLinkToExisting(false);
                  setSelectedExistingWorkerId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmSetupAsWorker}
                disabled={linkToExisting && !selectedExistingWorkerId}
              >
                {linkToExisting ? "Link to Worker" : "Continue to Setup"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
