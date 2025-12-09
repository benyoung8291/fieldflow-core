import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export type Module = 
  | "customers"
  | "leads"
  | "quotes"
  | "projects"
  | "service_orders"
  | "appointments"
  | "workers"
  | "service_contracts"
  | "analytics"
  | "settings"
  | "price_book"
  | "expenses"
  | "invoices"
  | "user_management"
  | "integrations"
  | "helpdesk"
  | "purchase_orders"
  | "suppliers"
  | "timesheets"
  | "tasks"
  | "field_reports"
  | "contacts"
  | "ap_invoices"
  | "workflows"
  | "knowledge_base"
  | "reports";

export type Permission = "view" | "create" | "edit" | "delete" | "approve" | "export" | "import";

export type PermissionConditions = {
  ownOnly?: boolean;
  maxAmount?: number;
  departments?: string[];
  [key: string]: any;
};

export type UserPermission = {
  module: string;
  permission: string;
  conditions?: PermissionConditions;
};

export const usePermissions = () => {
  const { data: userRoles, isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn("[usePermissions] No authenticated user");
          return [];
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role, tenant_id")
          .eq("user_id", user.id);

        if (error) {
          console.error("[usePermissions] Error fetching roles:", error);
          throw error;
        }
        
        console.log(`[usePermissions] Loaded ${data?.length || 0} roles:`, data);
        return data || [];
      } catch (err) {
        console.error("[usePermissions] Unexpected error in roles query:", err);
        // Return empty array instead of throwing to prevent app crash
        return [];
      }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 30000, // Cache for 30 seconds
  });

  const { data: permissions, isLoading: permissionsLoading, error: permissionsError } = useQuery({
    queryKey: ["user-permissions", userRoles],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn("[usePermissions] No authenticated user for permissions");
          return [];
        }

        if (!userRoles || userRoles.length === 0) {
          console.log("[usePermissions] No roles found, returning empty permissions");
          return [];
        }

        const roles = userRoles.map((r) => r.role);
        const tenantIds = userRoles.map((r) => r.tenant_id);
        
        const { data, error } = await supabase
          .from("role_permissions")
          .select("module, permission, conditions")
          .in("role", roles)
          .in("tenant_id", tenantIds)
          .eq("is_active", true);

        if (error) {
          console.error("[usePermissions] Error fetching permissions:", error);
          throw error;
        }
        
        console.log(`[usePermissions] Loaded ${data?.length || 0} permissions for roles:`, roles);
        return data as UserPermission[] || [];
      } catch (err) {
        console.error("[usePermissions] Unexpected error in permissions query:", err);
        // Return empty array instead of throwing to prevent app crash
        return [];
      }
    },
    enabled: !!userRoles && userRoles.length > 0,
    staleTime: 0, // Always fetch fresh
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const hasLoadedPermissions = useMemo(() => {
    // Still loading roles
    if (rolesLoading) return false;
    // Roles failed to load - consider done to prevent infinite loading
    if (rolesError) return true;
    // No roles means no permissions to load - done
    if (!userRoles || userRoles.length === 0) return true;
    // Still loading permissions for existing roles
    if (permissionsLoading) return false;
    // Permissions failed to load - consider done
    if (permissionsError) return true;
    // Permissions loaded successfully
    return permissions !== undefined;
  }, [rolesLoading, rolesError, userRoles, permissionsLoading, permissionsError, permissions]);

  const isAdmin = useMemo(() => 
    userRoles?.some((r) => r.role === "tenant_admin" || r.role === "super_admin") || false,
    [userRoles]
  );

  const isManagement = useMemo(() =>
    isAdmin || userRoles?.some((r) => r.role === "management" as any) || false,
    [userRoles, isAdmin]
  );

  const isSupervisor = useMemo(() =>
    isManagement || userRoles?.some((r) => r.role === "supervisor") || false,
    [userRoles, isManagement]
  );

  const hasPermission = (module: Module, permission: Permission, conditions?: PermissionConditions): boolean => {
    // Super admins, tenant admins, and management have all permissions
    if (isAdmin || isManagement) {
      return true;
    }

    const userPerm = permissions?.find(
      (p) => p.module === module && p.permission === permission
    );

    if (!userPerm) return false;

    // Check additional conditions if provided
    if (conditions && userPerm.conditions) {
      // Check ownOnly condition
      if (userPerm.conditions.ownOnly && !conditions.ownOnly) {
        return false;
      }
      
      // Check maxAmount condition
      if (userPerm.conditions.maxAmount && conditions.maxAmount) {
        if (conditions.maxAmount > userPerm.conditions.maxAmount) {
          return false;
        }
      }
    }

    return true;
  };

  const hasAnyPermission = (module: Module, perms: Permission[]): boolean => {
    return perms.some(p => hasPermission(module, p));
  };

  const hasAllPermissions = (module: Module, perms: Permission[]): boolean => {
    return perms.every(p => hasPermission(module, p));
  };

  const canView = (module: Module) => hasPermission(module, "view");
  const canCreate = (module: Module) => hasPermission(module, "create");
  const canEdit = (module: Module) => hasPermission(module, "edit");
  const canDelete = (module: Module) => hasPermission(module, "delete");
  const canApprove = (module: Module) => hasPermission(module, "approve");
  const canExport = (module: Module) => hasPermission(module, "export");

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
    canExport,
    isAdmin,
    isManagement,
    isSupervisor,
    userRoles: userRoles || [],
    permissions: permissions || [],
    isLoading: rolesLoading || permissionsLoading || (!!userRoles && userRoles.length > 0 && !permissions),
    hasLoadedPermissions,
  };
};
