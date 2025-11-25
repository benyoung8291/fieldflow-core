import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePresenceSystem } from "./usePresenceSystem";

interface UseGenericPresenceProps {
  recordId: string | null;
  tableName: string;
  displayField: string;
  moduleName: string;
  numberField?: string;
}

/**
 * Generic presence hook for tracking user presence on specific records
 * Uses centralized presence system for consistency
 */
export function useGenericPresence({
  recordId,
  tableName,
  displayField,
  moduleName,
  numberField,
}: UseGenericPresenceProps) {
  // Fetch record data for display
  const { data: record } = useQuery({
    queryKey: [`${tableName}-for-presence`, recordId],
    queryFn: async () => {
      if (!recordId) return null;
      
      const selectFields = numberField 
        ? `${displayField}, ${numberField}`
        : displayField;

      const { data, error } = await supabase
        .from(tableName as any)
        .select(selectFields)
        .eq("id", recordId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!recordId,
  });

  // Build page name from record data
  let pageName = moduleName;
  if (recordId && record) {
    const identifier = numberField && record[numberField]
      ? record[numberField]
      : record[displayField]?.substring(0, 30);
    pageName = `${moduleName}: ${identifier}`;
  }

  // Use centralized presence system
  usePresenceSystem({
    trackPresence: true,
    pageName,
    documentId: recordId,
    documentType: tableName,
  });
}
