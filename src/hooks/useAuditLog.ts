import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AuditLog {
  id: string;
  user_name: string;
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete" | "revert";
  field_name?: string;
  old_value?: string;
  new_value?: string;
  note?: string;
  created_at: string;
}

export function useAuditLog(tableName: string, recordId: string) {
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", tableName, recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const addNote = useMutation({
    mutationFn: async ({ logId, note }: { logId: string; note: string }) => {
      const { error } = await supabase
        .from("audit_logs")
        .update({ note })
        .eq("id", logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-logs", tableName, recordId] });
      toast.success("Note added successfully");
    },
    onError: () => {
      toast.error("Failed to add note");
    },
  });

  const revertChange = useMutation({
    mutationFn: async ({ logId, log }: { logId: string; log: AuditLog }) => {
      if (!log.field_name || !log.old_value) {
        throw new Error("Cannot revert this change");
      }

      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const userName = user.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user.email?.split("@")[0] || "Anonymous";

      // Revert the field value using type assertion
      const updateData: Record<string, any> = {
        [log.field_name]: log.old_value
      };
      
      const { error: updateError } = await (supabase
        .from(tableName as any)
        .update(updateData)
        .eq("id", recordId) as any);

      if (updateError) throw updateError;

      // Log the revert action
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        await supabase.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: user.id,
          user_name: userName,
          table_name: tableName,
          record_id: recordId,
          action: "revert",
          field_name: log.field_name,
          old_value: log.new_value,
          new_value: log.old_value,
          note: `Reverted change from ${log.created_at}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-logs", tableName, recordId] });
      toast.success("Change reverted successfully");
      // Invalidate the main data query to refresh the page
      queryClient.invalidateQueries({ queryKey: [tableName, recordId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to revert change");
    },
  });

  return {
    logs,
    isLoading,
    addNote,
    revertChange,
  };
}
