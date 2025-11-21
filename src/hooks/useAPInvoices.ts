import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAPInvoices(statusFilter?: string) {
  return useQuery({
    queryKey: ["ap-invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("ap_invoices")
        .select(`
          *,
          suppliers (
            id,
            name,
            email,
            acumatica_supplier_id
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAPInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["ap-invoice", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("Invoice ID required");
      
      const { data, error } = await supabase
        .from("ap_invoices")
        .select(`
          *,
          suppliers (
            id,
            name,
            email,
            phone,
            address,
            acumatica_supplier_id,
            abn,
            abn_validation_status,
            gst_registered
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateAPInvoice(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("ap_invoices")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["ap-invoices"] });
      toast.success("AP Invoice updated successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to update AP invoice");
    },
  });
}

export function useDeleteAPInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ap_invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-invoices"] });
      toast.success("AP Invoice deleted successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to delete AP invoice");
    },
  });
}

export function useSyncAPInvoiceToAcumatica(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "sync-ap-invoice-to-acumatica",
        {
          body: { invoice_id: id },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to sync to Acumatica");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["ap-invoices"] });
      toast.success("AP Invoice synced to Acumatica successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to sync AP invoice to Acumatica");
    },
  });
}
