import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignableWorker {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  worker_state: string | null;
}

export const useAssignableWorkers = () => {
  return useQuery({
    queryKey: ["assignable-workers"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's tenant_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) return [];

      // Get user_ids with 'worker' role
      const { data: workerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      if (rolesError) throw rolesError;

      const workerUserIds = workerRoles?.map((r) => r.user_id) || [];
      if (workerUserIds.length === 0) return [];

      // Fetch profiles for those workers (same tenant, active)
      // Use profiles_safe view to avoid RLS restrictions for supervisors
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("id, first_name, last_name, email, phone, worker_state, tenant_id")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .in("id", workerUserIds)
        .order("first_name");

      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id,
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        email: p.email,
        phone: p.phone,
        worker_state: p.worker_state,
      })) as AssignableWorker[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
