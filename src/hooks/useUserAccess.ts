import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserAccess() {
  return useQuery({
    queryKey: ["user-access"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Call the secure database function to get user access info
      const { data, error } = await supabase.rpc('get_user_access_info');

      if (error) {
        console.error('Error fetching user access:', error);
        throw error;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        throw new Error("No access data returned");
      }

      // Handle both single object and array responses
      const accessData = Array.isArray(data) ? data[0] : data;

      return {
        userId: accessData.user_id,
        hasRole: accessData.has_role,
        isWorker: accessData.is_worker,
        isCustomer: accessData.is_customer,
        customerId: accessData.customer_id,
        canAccessOffice: accessData.can_access_office,
        canAccessWorker: accessData.can_access_worker,
        canAccessCustomerPortal: accessData.can_access_customer_portal,
        showToggle: accessData.show_toggle,
        defaultRoute: accessData.default_route
      };
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
