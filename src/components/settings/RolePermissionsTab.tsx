import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const modules = [
  { key: "customers", label: "Customers" },
  { key: "leads", label: "Leads" },
  { key: "quotes", label: "Quotes" },
  { key: "projects", label: "Projects" },
  { key: "service_orders", label: "Service Orders" },
  { key: "appointments", label: "Appointments" },
  { key: "workers", label: "Workers" },
  { key: "service_contracts", label: "Service Contracts" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
  { key: "price_book", label: "Price Book" },
];

const roles = [
  { key: "tenant_admin", label: "Tenant Admin", description: "Full access to all modules" },
  { key: "supervisor", label: "Supervisor", description: "Manage teams and operations" },
  { key: "worker", label: "Worker", description: "Execute tasks and appointments" },
  { key: "viewer", label: "Viewer", description: "Read-only access" },
];

const permissions = ["view", "create", "edit", "delete"];

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
      {roles.map((role) => (
        <Card key={role.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {role.label}
              {role.key === "tenant_admin" && (
                <Badge variant="destructive">All Permissions</Badge>
              )}
            </CardTitle>
            <CardDescription>{role.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {role.key === "tenant_admin" ? (
              <p className="text-sm text-muted-foreground">
                Tenant admins have full access to all modules and cannot be restricted.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    {permissions.map((perm) => (
                      <TableHead key={perm} className="text-center">
                        {perm.charAt(0).toUpperCase() + perm.slice(1)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => (
                    <TableRow key={module.key}>
                      <TableCell className="font-medium">{module.label}</TableCell>
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
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
