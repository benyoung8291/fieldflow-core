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

      // Check if user has any role
      const { data: roleData } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      // Check if user is a worker
      const { data: workerData } = await (supabase as any)
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const hasRole = !!roleData;
      const isWorker = !!workerData;

      return {
        userId: user.id,
        hasRole,
        isWorker,
        canAccessOffice: hasRole,
        canAccessWorker: isWorker,
        showToggle: hasRole && isWorker,
        defaultRoute: hasRole ? "/dashboard" : isWorker ? "/worker/dashboard" : "/dashboard"
      };
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
