import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChatEligibleUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  avatar_url?: string | null;
}

/**
 * Fetches users who are eligible for chat (workers, supervisors, admins - NOT customers)
 */
export const useChatEligibleUsers = () => {
  return useQuery({
    queryKey: ["chat-eligible-users"],
    queryFn: async () => {
      // Get all users who have non-customer roles
      const { data: eligibleUserIds, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .not("role", "eq", "customer");

      if (rolesError) throw rolesError;

      // Get unique user IDs (users may have multiple roles)
      const uniqueUserIds = [...new Set(eligibleUserIds?.map((r) => r.user_id) || [])];

      if (uniqueUserIds.length === 0) return [];

      // Fetch profiles for eligible users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", uniqueUserIds)
        .eq("is_active", true)
        .order("first_name");

      if (profilesError) throw profilesError;

      return (profiles || []).map((user) => ({
        ...user,
        full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown",
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
