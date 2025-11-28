import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CustomerPortalRole = "full_access" | "supervisor" | "basic";

export type CustomerPortalPermission = 
  | "create_request"
  | "markup_floor_plan"
  | "view_service_orders"
  | "view_field_reports"
  | "view_appointments"
  | "view_financial"
  | "view_invoices"
  | "view_contracts";

export const useCustomerPortalPermissions = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-portal-permissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: portalUser, error } = await supabase
        .from("customer_portal_users")
        .select("portal_role, customer_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return portalUser;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const portalRole = data?.portal_role as CustomerPortalRole | null;
  const customerId = data?.customer_id;

  const hasPermission = (permission: CustomerPortalPermission): boolean => {
    if (!portalRole) return false;

    // Basic permissions (all roles)
    if (permission === "create_request" || permission === "markup_floor_plan") {
      return true;
    }

    // Supervisor permissions (supervisor + full_access)
    if (
      permission === "view_service_orders" ||
      permission === "view_field_reports" ||
      permission === "view_appointments"
    ) {
      return portalRole === "supervisor" || portalRole === "full_access";
    }

    // Full access permissions (only full_access)
    if (
      permission === "view_financial" ||
      permission === "view_invoices" ||
      permission === "view_contracts"
    ) {
      return portalRole === "full_access";
    }

    return false;
  };

  return {
    portalRole,
    customerId,
    hasPermission,
    isLoading,
    // Convenience helpers
    isBasicUser: portalRole === "basic",
    isSupervisor: portalRole === "supervisor",
    isFullAccess: portalRole === "full_access",
  };
};
