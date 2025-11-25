import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "super_admin" | "tenant_admin" | "supervisor" | "worker" | "accountant" | "warehouse_manager" | "subcontractor" | "management";

export function useUserRole() {
  return useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data?.role as UserRole | null;
    },
  });
}

export function useHasRole(requiredRoles: UserRole[]) {
  const { data: userRole, isLoading } = useUserRole();
  
  return {
    hasRole: userRole ? requiredRoles.includes(userRole) : false,
    isLoading,
    userRole,
  };
}

export function useCanManageKnowledge() {
  const result = useHasRole(["supervisor", "management", "tenant_admin", "super_admin"]);
  
  // Show button while loading or if user has required role
  // This prevents the button from disappearing during role check
  return {
    ...result,
    hasRole: result.isLoading || result.hasRole,
  };
}
