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

      console.log('useUserAccess - user.id:', user.id);

      // Check if user has any role
      const { data: roleData, error: roleError } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log('useUserAccess - roleData:', roleData, 'roleError:', roleError);

      // Check if user is a worker (workers.id is the link to auth.users, not user_id)
      const { data: workerData, error: workerError } = await (supabase as any)
        .from("workers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      console.log('useUserAccess - workerData:', workerData, 'workerError:', workerError);

      const hasRole = !!roleData;
      const isWorker = !!workerData;

      console.log('useUserAccess - hasRole:', hasRole, 'isWorker:', isWorker, 'showToggle:', hasRole && isWorker);

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
