import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Module = 
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
  | "price_book";

type Permission = "view" | "create" | "edit" | "delete";

export const usePermissions = () => {
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: permissions } = useQuery({
    queryKey: ["user-permissions", userRoles],
    queryFn: async () => {
      if (!userRoles || userRoles.length === 0) return [];

      const roles = userRoles.map((r) => r.role);
      const { data, error } = await supabase
        .from("role_permissions")
        .select("module, permission")
        .in("role", roles);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userRoles && userRoles.length > 0,
  });

  const hasPermission = (module: Module, permission: Permission): boolean => {
    // Tenant admins have all permissions
    if (userRoles?.some((r) => r.role === "tenant_admin")) {
      return true;
    }

    return (
      permissions?.some(
        (p) => p.module === module && p.permission === permission
      ) || false
    );
  };

  const isAdmin = userRoles?.some((r) => r.role === "tenant_admin") || false;

  return {
    hasPermission,
    isAdmin,
    userRoles: userRoles || [],
  };
};
