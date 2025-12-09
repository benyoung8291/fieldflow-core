import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OrphanedWorker {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

/**
 * Hook to detect workers that were created but don't have proper role assignment.
 * This catches edge cases where the create-worker flow partially failed.
 */
export function useOrphanedWorkerCheck() {
  return useQuery({
    queryKey: ["orphaned-workers"],
    queryFn: async () => {
      // Get profiles that have worker_state set (indicating they were created as workers)
      // but don't have a corresponding worker role in user_roles
      const { data: profilesWithWorkerState, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, created_at, worker_state")
        .not("worker_state", "is", null);

      if (profilesError) throw profilesError;

      if (!profilesWithWorkerState || profilesWithWorkerState.length === 0) {
        return [];
      }

      // Get all user_ids that have worker role
      const { data: workerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      if (rolesError) throw rolesError;

      const workerUserIds = new Set(workerRoles?.map(r => r.user_id) || []);

      // Find profiles that have worker_state but no worker role
      const orphanedWorkers: OrphanedWorker[] = profilesWithWorkerState
        .filter(profile => !workerUserIds.has(profile.id))
        .map(profile => ({
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          created_at: profile.created_at,
        }));

      return orphanedWorkers;
    },
    refetchInterval: 60000, // Check every minute
    staleTime: 30000,
  });
}
