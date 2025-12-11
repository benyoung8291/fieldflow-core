import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
}

export const useWorkersCache = () => {
  return useQuery({
    queryKey: ["workers-cache"],
    queryFn: async () => {
      // Use profiles_safe view to avoid exposing sensitive payroll data
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      
      if (error) throw error;
      
      // Add computed full_name field
      return (data || []).map((worker) => ({
        ...worker,
        full_name: `${worker.first_name} ${worker.last_name}`,
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useWorkerById = (workerId: string | null | undefined) => {
  const { data: workers = [] } = useWorkersCache();
  return workers.find((w) => w.id === workerId);
};
