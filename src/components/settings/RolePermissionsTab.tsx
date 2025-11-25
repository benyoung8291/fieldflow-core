import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

const modules = [
  { key: "customers", label: "Customers", description: "Customer records and information" },
  { key: "leads", label: "Leads", description: "Lead management and conversion" },
  { key: "quotes", label: "Quotes", description: "Quote creation and management" },
  { key: "projects", label: "Projects", description: "Project planning and execution" },
  { key: "service_orders", label: "Service Orders", description: "Service order management" },
  { key: "appointments", label: "Appointments", description: "Schedule and manage appointments" },
  { key: "workers", label: "Workers", description: "Worker profiles and assignments" },
  { key: "service_contracts", label: "Service Contracts", description: "Contract management" },
  { key: "analytics", label: "Analytics", description: "Reports and business intelligence" },
  { key: "settings", label: "Settings", description: "System configuration and preferences" },
  { key: "price_book", label: "Price Book", description: "Pricing and catalog management" },
  { key: "expenses", label: "Expenses", description: "Expense tracking and approval" },
  { key: "invoices", label: "Invoices", description: "Invoice creation and management" },
  { key: "user_management", label: "User Management", description: "User accounts and roles" },
  { key: "integrations", label: "Integrations", description: "Third-party integrations" },
];

const roles = [
  { key: "tenant_admin", label: "Tenant Admin", description: "Full access to all modules and settings", color: "destructive" },
  { key: "management", label: "Management", description: "Strategic oversight and high-level approvals across the organization", color: "destructive" },
  { key: "supervisor", label: "Supervisor", description: "Manage teams, approve requests, and oversee operations", color: "default" },
  { key: "worker", label: "Worker", description: "Execute assigned tasks and update records", color: "secondary" },
  { key: "viewer", label: "Viewer", description: "Read-only access to assigned modules", color: "outline" },
];

const permissions = ["view", "create", "edit", "delete", "approve", "export"];

export const RolePermissionsTab = () => {
  const queryClient = useQueryClient();

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

  const { data: rolePermissions, isLoading } = useQuery({
    queryKey: ["role-permissions", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("tenant_id", profile.tenant_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });

  const togglePermissionMutation = useMutation({
    mutationFn: async ({
      role,
      module,
      permission,
      hasPermission,
    }: {
      role: string;
      module: string;
      permission: string;
      hasPermission: boolean;
    }) => {
      if (!profile?.tenant_id) throw new Error("No tenant ID");

      if (hasPermission) {
        // Remove permission
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("tenant_id", profile.tenant_id)
          .eq("role", role as any)
          .eq("module", module as any)
          .eq("permission", permission as any);

        if (error) throw error;
      } else {
        // Add permission
        const { error } = await supabase
          .from("role_permissions")
          .insert({
            tenant_id: profile.tenant_id,
            role: role as any,
            module: module as any,
            permission: permission as any,
          } as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Permission updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update permission");
    },
  });

  const hasPermission = (role: string, module: string, permission: string) => {
    return rolePermissions?.some(
      (p) => p.role === role && p.module === module && p.permission === permission
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <Badge variant="outline" className="mt-0.5">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Info
          </Badge>
          <div className="space-y-1">
            <p className="text-sm font-medium">Granular Permission Control</p>
            <p className="text-sm text-muted-foreground">
              Configure precise access rights for each role. Tenant admins always have full access.
              Changes take effect immediately for all users with the role.
            </p>
          </div>
        </div>
      </div>

      {roles.map((role) => (
        <Card key={role.key}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {role.label}
                  {role.key === "tenant_admin" && (
                    <Badge variant="destructive">All Permissions</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">{role.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {role.key === "tenant_admin" || role.key === "management" ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground">
                  {role.key === "tenant_admin" 
                    ? "Tenant administrators have unrestricted access to all modules and features. Their permissions cannot be modified to ensure system security and integrity."
                    : "Management users have unrestricted access to all modules and features for strategic oversight and decision-making."
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">
                        <div>
                          <div className="font-semibold">Module</div>
                          <div className="text-xs text-muted-foreground font-normal">Resource type</div>
                        </div>
                      </TableHead>
                      {permissions.map((perm) => (
                        <TableHead key={perm} className="text-center min-w-[80px]">
                          <div className="font-semibold capitalize">{perm}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((module) => (
                      <TableRow key={module.key} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{module.label}</div>
                            <div className="text-xs text-muted-foreground">{module.description}</div>
                          </div>
                        </TableCell>
                        {permissions.map((perm) => {
                          const checked = hasPermission(role.key, module.key, perm);
                          return (
                            <TableCell key={perm} className="text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() =>
                                    togglePermissionMutation.mutate({
                                      role: role.key,
                                      module: module.key,
                                      permission: perm,
                                      hasPermission: checked || false,
                                    })
                                  }
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
