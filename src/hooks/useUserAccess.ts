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
      const { data, error } = await supabase
        .rpc('get_user_access_info')
        .single();

      if (error) {
        console.error('Error fetching user access:', error);
        throw error;
      }

      if (!data) {
        throw new Error("No access data returned");
      }

      return {
        userId: data.user_id,
        hasRole: data.has_role,
        isWorker: data.is_worker,
        canAccessOffice: data.can_access_office,
        canAccessWorker: data.can_access_worker,
        showToggle: data.show_toggle,
        defaultRoute: data.default_route
      };
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
