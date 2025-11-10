import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useWorkerRole = () => {
  const { data: userData } = useQuery({
    queryKey: ["worker-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check if user has supervisor or admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isSupervisorOrAbove = roles?.some((r) => 
        r.role === "tenant_admin" || 
        r.role === "supervisor" || 
        r.role === "manager"
      ) || false;

      // Check if user is also a worker
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      // Check if profile exists in workers context (could check a worker-specific field)
      const isWorker = !!profile;

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
