import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SubcontractorWorker {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  supplier_id: string;
  supplier_name: string;
  worker_state: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

export const useSubcontractorWorkers = (stateFilter?: string) => {
  return useQuery({
    queryKey: ["subcontractor-workers", stateFilter],
    queryFn: async () => {
      // Fetch contacts that are enabled as assignable workers with their supplier info
      let query = supabase
        .from("contacts")
        .select(`
          id,
          first_name,
          last_name,
          supplier_id,
          worker_state,
          email,
          phone,
          mobile,
          suppliers(id, name)
        `)
        .eq("is_assignable_worker", true)
        .eq("status", "active")
        .not("supplier_id", "is", null);

      // Apply state filter if provided
      if (stateFilter && stateFilter !== "all") {
        query = query.eq("worker_state", stateFilter);
      }

      const { data, error } = await query.order("first_name");

      if (error) throw error;

      // Transform the data to include supplier name and full name
      return (data || []).map((contact: any) => ({
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        full_name: `${contact.first_name} ${contact.last_name}`,
        supplier_id: contact.supplier_id,
        supplier_name: contact.suppliers?.name || "Unknown Supplier",
        worker_state: contact.worker_state,
        email: contact.email,
        phone: contact.phone,
        mobile: contact.mobile,
      })) as SubcontractorWorker[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useSubcontractorWorkerById = (contactId: string | null | undefined) => {
  const { data: subcontractors = [] } = useSubcontractorWorkers();
  return subcontractors.find((s) => s.id === contactId);
};
