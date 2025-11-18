import { supabase } from "@/integrations/supabase/client";

export async function bulkMergeCustomerLocations(customerId: string) {
  const { data, error } = await supabase.functions.invoke('bulk-merge-locations', {
    body: { customerId },
  });

  if (error) throw error;
  return data;
}