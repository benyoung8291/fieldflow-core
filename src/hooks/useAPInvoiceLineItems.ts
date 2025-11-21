import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAPInvoiceLineItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["ap-invoice-line-items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      if (!invoiceId) throw new Error("Invoice ID required");

      const { data, error } = await supabase
        .from("ap_invoice_line_items")
        .select("*")
        .eq("ap_invoice_id", invoiceId)
        .order("item_order");

      if (error) throw error;
      return data;
    },
  });
}

export function useAddAPInvoiceLineItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newItem: any) => {
      const { data: invoice } = await supabase
        .from("ap_invoices")
        .select("tenant_id")
        .eq("id", invoiceId)
        .single();

      if (!invoice) throw new Error("Invoice not found");

      const { error } = await supabase.from("ap_invoice_line_items").insert({
        ap_invoice_id: invoiceId,
        tenant_id: invoice.tenant_id,
        ...newItem,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-invoice-line-items", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["ap-invoice", invoiceId] });
      toast.success("Line item added successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to add line item");
    },
  });
}

export function useUpdateAPInvoiceLineItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: any }) => {
      const { error } = await supabase
        .from("ap_invoice_line_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-invoice-line-items", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["ap-invoice", invoiceId] });
      toast.success("Line item updated successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to update line item");
    },
  });
}

export function useDeleteAPInvoiceLineItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("ap_invoice_line_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-invoice-line-items", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["ap-invoice", invoiceId] });
      toast.success("Line item deleted successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to delete line item");
    },
  });
}
