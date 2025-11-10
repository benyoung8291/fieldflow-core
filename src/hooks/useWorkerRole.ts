import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useWorkerRole = () => {
  const { data: userData } = useQuery({
    queryKey: ["worker-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check if user has supervisor or admin role
      const rolesQuery = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isSupervisorOrAbove = rolesQuery.data?.some((r: any) => 
        r.role === "tenant_admin" || r.role === "supervisor"
      ) || false;

      // Check if user is also a worker (exists in workers table)
      // Using any cast to avoid TypeScript deep instantiation error with complex Supabase types
      const workerQuery = await (supabase as any)
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      const isWorker = workerQuery?.data && workerQuery.data.length > 0;

      return {
        userId: user.id,
        isSupervisorOrAbove,
        isWorker,
        showToggle: isSupervisorOrAbove && isWorker,
      };
    },
  });

  return userData || {
    userId: null,
    isSupervisorOrAbove: false,
    isWorker: false,
    showToggle: false,
  };
};
