import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Ban, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Module } from "@/hooks/usePermissions";

const modules: { key: Module; label: string; description: string; group: string }[] = [
  { key: "customers", label: "Customers", description: "Customer records and information", group: "CRM" },
  { key: "leads", label: "Leads", description: "Lead management and conversion", group: "CRM" },
  { key: "contacts", label: "Contacts", description: "Contact management and CRM", group: "CRM" },
  { key: "quotes", label: "Quotes", description: "Quote creation and management", group: "Sales" },
  { key: "invoices", label: "Invoices", description: "Invoice creation and management", group: "Financial" },
  { key: "expenses", label: "Expenses", description: "Expense tracking and approval", group: "Financial" },
  { key: "ap_invoices", label: "AP Invoices", description: "Accounts payable invoice processing", group: "Financial" },
  { key: "projects", label: "Projects", description: "Project planning and execution", group: "Operations" },
  { key: "service_orders", label: "Service Orders", description: "Service order management", group: "Operations" },
  { key: "service_contracts", label: "Service Contracts", description: "Contract management", group: "Operations" },
  { key: "appointments", label: "Appointments", description: "Schedule and manage appointments", group: "Operations" },
  { key: "tasks", label: "Tasks", description: "Task assignment and tracking", group: "Operations" },
  { key: "field_reports", label: "Field Reports", description: "On-site reporting and documentation", group: "Operations" },
  { key: "purchase_orders", label: "Purchase Orders", description: "PO creation and approval", group: "Procurement" },
  { key: "suppliers", label: "Suppliers", description: "Vendor and supplier management", group: "Procurement" },
  { key: "workers", label: "Workers", description: "Worker profiles and assignments", group: "HR" },
  { key: "timesheets", label: "Timesheets", description: "Time tracking and approval", group: "HR" },
  { key: "price_book", label: "Price Book", description: "Pricing and catalog management", group: "Configuration" },
  { key: "workflows", label: "Workflows", description: "Automation and process flows", group: "Configuration" },
  { key: "analytics", label: "Analytics", description: "Reports and business intelligence", group: "Reporting" },
  { key: "reports", label: "Reports", description: "Financial and operational reports", group: "Reporting" },
  { key: "helpdesk", label: "Help Desk", description: "Ticket management and support", group: "Support" },
  { key: "knowledge_base", label: "Knowledge Base", description: "Documentation and articles", group: "Support" },
  { key: "integrations", label: "Integrations", description: "Third-party integrations", group: "Admin" },
  { key: "user_management", label: "User Management", description: "User accounts and roles", group: "Admin" },
  { key: "settings", label: "Settings", description: "System configuration and preferences", group: "Admin" },
];

const roles = [
  { key: "tenant_admin", label: "Tenant Admin", description: "Full access to all modules and settings", color: "destructive" },
  { key: "management", label: "Management", description: "Strategic oversight and high-level approvals across the organization", color: "destructive" },
  { key: "supervisor", label: "Supervisor", description: "Manage teams, approve requests, and oversee operations", color: "default" },
  { key: "worker", label: "Worker", description: "Execute assigned tasks and update records", color: "secondary" },
  { key: "accountant", label: "Accountant", description: "Financial management and reporting", color: "default" },
  { key: "warehouse_manager", label: "Warehouse Manager", description: "Inventory and warehouse operations", color: "default" },
  { key: "subcontractor", label: "Subcontractor", description: "External contractor access", color: "outline" },
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

  const hasPermission = (role: string, module: string, permission: string) => {
    return rolePermissions?.some(
      (p) => p.role === role && p.module === module && p.permission === permission
    );
  };

  const hasAnyPermission = (role: string, module: string) => {
    return rolePermissions?.some(
      (p) => p.role === role && p.module === module
    );
  };

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

  const blockModuleMutation = useMutation({
    mutationFn: async ({ role, module }: { role: string; module: string }) => {
      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("tenant_id", profile.tenant_id)
        .eq("role", role as any)
        .eq("module", module as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Module access blocked successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error blocking module access");
    },
  });

  const grantViewMutation = useMutation({
    mutationFn: async ({ role, module }: { role: string; module: string }) => {
      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { error } = await supabase
        .from("role_permissions")
        .insert({
          tenant_id: profile.tenant_id,
          role: role as any,
          module: module as any,
          permission: "view",
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("View permission granted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error granting permission");
    },
  });

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
              Use the "Block" button to remove all permissions for a module, or "Grant View" to restore basic access.
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
                      <TableHead className="text-center min-w-[120px]">
                        <div className="font-semibold">Access Control</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((module) => {
                      const moduleHasAccess = hasAnyPermission(role.key, module.key);
                      
                      return (
                        <TableRow 
                          key={module.key} 
                          className={cn(
                            "hover:bg-muted/50",
                            !moduleHasAccess && "bg-destructive/5"
                          )}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {!moduleHasAccess && (
                                <Badge variant="destructive" className="text-xs">
                                  <Ban className="h-3 w-3 mr-1" />
                                  No Access
                                </Badge>
                              )}
                              <div>
                                <div className="font-medium">{module.label}</div>
                                <div className="text-xs text-muted-foreground">{module.description}</div>
                              </div>
                            </div>
                          </TableCell>
                          {permissions.map((perm) => {
                            const checked = hasPermission(role.key, module.key, perm);
                            return (
                              <TableCell key={perm} className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={checked}
                                    disabled={!moduleHasAccess && perm !== "view"}
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
                          <TableCell className="text-center">
                            {moduleHasAccess ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => blockModuleMutation.mutate({ role: role.key, module: module.key })}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                Block
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => grantViewMutation.mutate({ role: role.key, module: module.key })}
                                className="text-success hover:text-success hover:bg-success/10"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Grant View
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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