import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DocumentDetailLayout, { StatusBadge, DocumentAction, TabConfig } from "@/components/layout/DocumentDetailLayout";
import KeyInfoCard from "@/components/layout/KeyInfoCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, CheckCircle, Download, Plus, Edit, Archive, Check, ExternalLink, DollarSign, Calendar, FileText, User, Mail, ListChecks, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import EditInvoiceLineDialog from "@/components/invoices/EditInvoiceLineDialog";
import AddInvoiceLineDialog from "@/components/invoices/AddInvoiceLineDialog";
import { InlineInvoiceLineItemRow } from "@/components/invoices/InlineInvoiceLineItemRow";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";
import ProjectDialog from "@/components/projects/ProjectDialog";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LinkedHelpdeskTicketsTab } from "@/components/helpdesk/LinkedHelpdeskTicketsTab";
import { LinkedDocumentsTimeline } from "@/components/audit/LinkedDocumentsTimeline";
import AuditTimeline from "@/components/audit/AuditTimeline";
import ThreeWayMatchingCard from "@/components/invoices/ThreeWayMatchingCard";
import { Package } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [serviceOrderDialogOpen, setServiceOrderDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [deleteInvoiceDialogOpen, setDeleteInvoiceDialogOpen] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (
            id,
            name,
            email,
            billing_address
          ),
          suppliers (
            id,
            name,
            email,
            acumatica_supplier_id
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch accounting integration for Acumatica link
  const { data: accountingIntegration } = useQuery({
    queryKey: ["accounting-integration", invoice?.tenant_id],
    queryFn: async () => {
      if (!invoice?.tenant_id) return null;
      
      const { data, error } = await supabase
        .from("accounting_integrations")
        .select("acumatica_instance_url")
        .eq("tenant_id", invoice.tenant_id)
        .eq("provider", "myob_acumatica")
        .eq("is_enabled", true)
        .single();

      if (error) return null;
      return data;
    },
    // @ts-ignore - sync_status will exist
    enabled: !!invoice?.tenant_id && !!(invoice?.acumatica_reference_nbr || invoice?.sync_status === 'synced'),
  });

  // Fetch suppliers for editing
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, email, acumatica_supplier_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: lineItems } = useQuery({
    queryKey: ["invoice-line-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("item_order");

      if (error) throw error;

      // Fetch source document details for each line item
      const sourceDocuments = new Map();
      
      for (const item of data || []) {
        if (!item.source_id || !item.source_type) continue;
        
        const key = `${item.source_type}-${item.source_id}`;
        if (sourceDocuments.has(key)) continue;

        if (item.source_type === "project") {
          const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("id, name, start_date, end_date")
            .eq("id", item.source_id)
            .single();
          
          if (!projectError && project) {
            sourceDocuments.set(key, { 
              type: "project" as const, 
              id: project.id,
              name: project.name,
              start_date: project.start_date,
              end_date: project.end_date
            });
          }
        } else if (item.source_type === "service_order") {
          const { data: order, error: orderError } = await supabase
            .from("service_orders")
            .select("id, order_number, title, work_order_number, purchase_order_number")
            .eq("id", item.source_id)
            .single();
          
          if (!orderError && order) {
            sourceDocuments.set(key, { 
              type: "service_order" as const,
              id: order.id,
              order_number: order.order_number,
              title: order.title,
              work_order_number: order.work_order_number,
              purchase_order_number: order.purchase_order_number
            });
          }
        }
      }

      return { lineItems: data, sourceDocuments };
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      // Check if invoice is released in Acumatica
      if (invoice?.acumatica_status === "Released") {
        throw new Error("Cannot modify invoice status - invoice is Released in MYOB Acumatica. Contact admin to void or reverse.");
      }

      // If moving to approved status, trigger accounting sync FIRST
      if (status === "approved") {
        console.log("Attempting to approve invoice - triggering accounting sync first:", id);
        
        // Determine which sync function to call based on invoice type
        // @ts-ignore - invoice_type exists on invoice table
        const syncFunctionName = invoice?.invoice_type === 'ap' 
          ? 'sync-ap-invoice-to-acumatica' 
          : 'sync-invoice-to-accounting';
        
        // @ts-ignore - invoice_type exists on invoice table
        console.log(`Calling ${syncFunctionName} for invoice type: ${invoice?.invoice_type}`);
        
        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          syncFunctionName,
          {
            body: { invoice_id: id },
          }
        );

        if (syncError) {
          console.error("Accounting sync error:", syncError);
          throw new Error(`Acumatica sync failed: ${syncError.message}`);
        }

        console.log("Accounting sync response:", syncData);

        // Check if sync failed (different response structure for different functions)
        if (syncFunctionName === 'sync-invoice-to-accounting') {
          if (syncData?.results?.some((r: any) => r.status === "failed")) {
            const failedResult = syncData.results.find((r: any) => r.status === "failed");
            throw new Error(failedResult.error || "Unknown sync error");
          }
        } else {
          // For AP invoice sync
          if (!syncData?.success) {
            throw new Error(syncData?.error || "Failed to sync AP invoice to Acumatica");
          }
        }

        console.log("Accounting sync successful, proceeding to update status");
      }

      // Only update status if sync was successful (or not needed)
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: (status) => {
      // Show loading toast when approving
      if (status === "approved") {
        // @ts-ignore - invoice_type exists on invoice table
        const toastMessage = invoice?.invoice_type === 'ap'
          ? "Syncing AP Invoice to MYOB Acumatica..."
          : "Syncing invoice to MYOB Acumatica...";
        toast.loading(toastMessage, { id: "invoice-sync" });
      }
    },
    onSuccess: (_, status) => {
      // Dismiss loading toast
      if (status === "approved") {
        toast.dismiss("invoice-sync");
      }
      
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "invoices", id] });
      
      if (status === "approved") {
        // @ts-ignore - invoice_type exists on invoice table
        const successMessage = invoice?.invoice_type === 'ap'
          ? "AP Invoice approved and synced to MYOB Acumatica successfully"
          : "Invoice approved and synced to MYOB Acumatica successfully";
        toast.success(successMessage);
      } else {
        toast.success("Invoice status updated successfully");
      }
    },
    onError: (error: any, status) => {
      // Dismiss loading toast
      if (status === "approved") {
        toast.dismiss("invoice-sync");
      }
      toast.error(error.message || "Failed to update invoice status");
    },
  });

  const updateLineItemMutation = useMutation({
    mutationFn: async ({ itemId, updates, isFromSource }: { itemId: string; updates: any; isFromSource: boolean }) => {
      // Check if invoice is released in Acumatica
      if (invoice?.acumatica_status === "Released") {
        throw new Error("Cannot modify line items - invoice is Released in MYOB Acumatica. Contact admin to void or reverse.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the line item before update to log the change
      const { data: oldItem } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("id", itemId)
        .single();

      // Update the line item
      const { error } = await supabase
        .from("invoice_line_items")
        .update({
          description: updates.description,
          quantity: updates.quantity,
          unit_price: updates.unit_price,
          line_total: updates.line_total,
          account_code: updates.account_code,
          sub_account: updates.sub_account,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Get user profile for audit logging
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        const userName = `${profile.first_name} ${profile.last_name || ""}`.trim();

        // Log to invoice audit history
        await supabase.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: user.id,
          user_name: userName,
          table_name: "invoices",
          record_id: id!,
          action: "update",
          field_name: "line_item_edited",
          old_value: oldItem ? `${oldItem.description} (Qty: ${oldItem.quantity}, Price: $${oldItem.unit_price})` : null,
          new_value: `${updates.description} (Qty: ${updates.quantity}, Price: $${updates.unit_price})`,
          note: isFromSource ? `Line item from ${updates.source_type?.replace('_', ' ')} was modified` : "Line item modified",
        });

        // If this was from a source document, also log the change there
        if (isFromSource && updates.source_type && updates.source_id) {
          const sourceTable = updates.source_type === "project" ? "projects" : "service_orders";

          await supabase.from("audit_logs").insert({
            tenant_id: profile.tenant_id,
            user_id: user.id,
            user_name: userName,
            table_name: sourceTable,
            record_id: updates.source_id,
            action: "update",
            field_name: "line_item_modified_in_invoice",
            old_value: `Original: ${oldItem?.description}`,
            new_value: `Modified in invoice ${invoice?.invoice_number}`,
            note: `Line item edited in invoice. Link: /invoices/${id}`,
          });
        }
      }

      // Recalculate invoice totals
      const { data: allItems } = await supabase
        .from("invoice_line_items")
        .select("line_total")
        .eq("invoice_id", id);

      if (allItems) {
        const subtotal = allItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
        const taxRate = 10; // 10% GST
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        await supabase
          .from("invoices")
          .update({
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalAmount,
          })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-line-items", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "invoices", id] });
      toast.success("Line item updated successfully");
    },
    onError: () => {
      toast.error("Failed to update line item");
    },
  });

  const addLineItemMutation = useMutation({
    mutationFn: async (newItem: any) => {
      // Check if invoice is released in Acumatica
      if (invoice?.acumatica_status === "Released") {
        throw new Error("Cannot add line items - invoice is Released in MYOB Acumatica. Contact admin to void or reverse.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("No profile found");

      // Get the max item_order
      const { data: existingItems } = await supabase
        .from("invoice_line_items")
        .select("item_order")
        .eq("invoice_id", id)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = existingItems && existingItems.length > 0 ? existingItems[0].item_order + 1 : 0;

      const { error } = await supabase
        .from("invoice_line_items")
        .insert({
          tenant_id: profile.tenant_id,
          invoice_id: id,
          description: newItem.description,
          quantity: newItem.quantity,
          unit_price: newItem.unit_price,
          line_total: newItem.line_total,
          item_order: nextOrder,
          account_code: newItem.account_code,
          sub_account: newItem.sub_account,
        });

      if (error) throw error;

      // Log to invoice audit history
      const userName = `${profile.first_name} ${profile.last_name || ""}`.trim();
      await supabase.from("audit_logs").insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        user_name: userName,
        table_name: "invoices",
        record_id: id!,
        action: "update",
        field_name: "line_item_added",
        old_value: null,
        new_value: `${newItem.description} (Qty: ${newItem.quantity}, Price: $${newItem.unit_price})`,
        note: "New line item added to invoice",
      });

      // Recalculate invoice totals
      const { data: allItems } = await supabase
        .from("invoice_line_items")
        .select("line_total")
        .eq("invoice_id", id);

      if (allItems) {
        const subtotal = allItems.reduce((sum, item) => sum + (item.line_total || 0), 0) + newItem.line_total;
        const taxRate = 10; // 10% GST
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        await supabase
          .from("invoices")
          .update({
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalAmount,
          })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-line-items", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "invoices", id] });
      toast.success("Line item added successfully");
    },
    onError: () => {
      toast.error("Failed to add line item");
    },
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      // Check if invoice is released in Acumatica
      if (invoice?.acumatica_status === "Released") {
        throw new Error("Cannot delete line items - invoice is Released in MYOB Acumatica. Contact admin to void or reverse.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the line item before deletion to log the change
      const { data: deletedItem } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("id", itemId)
        .single();

      const { error } = await supabase
        .from("invoice_line_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      // Log to invoice audit history
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (profile && deletedItem) {
        const userName = `${profile.first_name} ${profile.last_name || ""}`.trim();
        await supabase.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: user.id,
          user_name: userName,
          table_name: "invoices",
          record_id: id!,
          action: "update",
          field_name: "line_item_deleted",
          old_value: `${deletedItem.description} (Qty: ${deletedItem.quantity}, Price: $${deletedItem.unit_price})`,
          new_value: null,
          note: "Line item removed from invoice",
        });
      }

      // Recalculate invoice totals
      const { data: allItems } = await supabase
        .from("invoice_line_items")
        .select("line_total")
        .eq("invoice_id", id);

      const subtotal = allItems?.reduce((sum, item) => sum + (item.line_total || 0), 0) || 0;
      const taxRate = 10; // 10% GST
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      await supabase
        .from("invoices")
        .update({
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-line-items", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "invoices", id] });
      toast.success("Line item deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete line item");
    },
  });

  const archiveInvoiceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "archived" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice archived successfully");
      navigate("/invoices");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to archive invoice");
    },
  });

  const syncAcumaticaStatusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'sync-acumatica-invoice-status',
        {
          body: { invoice_id: id }
        }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "invoices", id] });
      toast.success("Invoice status synced from Acumatica successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to sync invoice status from Acumatica");
    },
  });

  // Removed supplier mutation - invoices table is AR-only now

  const recalculateTotalsMutation = useMutation({
    mutationFn: async () => {
      // Check if invoice is released in Acumatica
      if (invoice?.acumatica_status === "Released") {
        throw new Error("Cannot recalculate totals - invoice is Released in MYOB Acumatica.");
      }

      // Get all line items
      const { data: allItems, error: itemsError } = await supabase
        .from("invoice_line_items")
        .select("line_total")
        .eq("invoice_id", id);

      if (itemsError) throw itemsError;

      const subtotal = allItems?.reduce((sum, item) => sum + (item.line_total || 0), 0) || 0;
      const taxRate = 10; // 10% GST
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      const { error } = await supabase
        .from("invoices")
        .update({
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Invoice totals recalculated successfully");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(error.message || "Failed to recalculate totals");
    },
  });

  if (isLoading || !invoice) {
    return (
      <DocumentDetailLayout
        title="Loading..."
        backPath="/invoices"
        tabs={[]}
        isLoading={isLoading}
        notFoundMessage={!isLoading && !invoice ? "Invoice not found" : undefined}
      />
    );
  }

  // Check if invoice is locked due to Acumatica Released status
  const isAcumaticaReleased = invoice.acumatica_status === "Released";
  const canEdit = invoice.status === "draft" && !isAcumaticaReleased;

  // Status badges configuration
  const statusBadges: StatusBadge[] = [
    {
      label: invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
      variant: invoice.status === "draft" ? "outline" : invoice.status === "sent" ? "secondary" : invoice.status === "overdue" ? "destructive" : "default",
    },
    ...(invoice.is_progress_invoice ? [{
      label: "Progress",
      variant: "outline" as const,
      className: "text-xs",
    }] : []),
    // @ts-ignore - sync_status will exist
    ...(invoice.sync_status === 'synced' && invoice.acumatica_reference_nbr ? [{
      label: "Synced to Acumatica",
      variant: "secondary" as const,
      className: "text-xs",
    }] : []),
    ...(invoice.acumatica_status ? [{
      label: `Acumatica: ${invoice.acumatica_status}`,
      variant: invoice.acumatica_status === "Released" ? "destructive" as const : "secondary" as const,
      className: "text-xs",
    }] : []),
  ];

  // Primary actions configuration
  const primaryActions: DocumentAction[] = [];
  
  // Only show actions if invoice is not Released in Acumatica
  if (!isAcumaticaReleased) {
    // @ts-ignore - invoice_type exists
    const isAPInvoice = invoice.invoice_type === 'ap';
    
    if (invoice.status === "draft") {
      primaryActions.push({
        label: draftSaved ? "Saved" : "Save Draft",
        icon: draftSaved ? <Check className="h-4 w-4" /> : undefined,
        onClick: () => {
          setDraftSaved(true);
          toast.success("Draft saved successfully");
          setTimeout(() => setDraftSaved(false), 2000);
        },
        variant: "outline",
      });
      
      // For AP invoices, go directly to approved. For AR invoices, send to customer first
      if (isAPInvoice) {
        primaryActions.push({
          label: "Approve",
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: () => updateStatusMutation.mutate("approved"),
          variant: "default",
        });
      } else {
        primaryActions.push({
          label: "Send to Customer",
          icon: <Send className="h-4 w-4" />,
          onClick: () => updateStatusMutation.mutate("sent"),
          variant: "default",
        });
      }
    } else if (invoice.status === "sent") {
      primaryActions.push({
        label: "Back to Draft",
        onClick: () => updateStatusMutation.mutate("draft"),
        variant: "outline",
      });
      primaryActions.push({
        label: "Mark as Approved",
        icon: <CheckCircle className="h-4 w-4" />,
        onClick: () => updateStatusMutation.mutate("approved"),
        variant: "default",
      });
    } else if (invoice.status === "approved" && !invoice.acumatica_status) {
      // Only allow unapprove if not yet synced to Acumatica
      primaryActions.push({
        label: "Unapprove",
        onClick: () => updateStatusMutation.mutate(isAPInvoice ? "draft" : "sent"),
        variant: "outline",
      });
    }
  }

  primaryActions.push({
    label: "Download PDF",
    icon: <Download className="h-4 w-4" />,
    onClick: () => {},
    variant: "outline",
  });

  // Only show archive button if invoice is draft
  if (invoice.status === "draft") {
    primaryActions.push({
      label: "Archive",
      icon: <Archive className="h-4 w-4" />,
      onClick: () => setDeleteInvoiceDialogOpen(true),
      variant: "outline",
    });
  }

  // Key info section
  const keyInfoSection = (
    <div className="space-y-4">
      {isAcumaticaReleased && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-destructive">Invoice Locked - Released in MYOB Acumatica</div>
              <div className="text-sm text-muted-foreground mt-1">
                This invoice has been released in MYOB Acumatica and cannot be modified. 
                {invoice.acumatica_reference_nbr && accountingIntegration?.acumatica_instance_url && (
                  <>
                    <br />
                    <a
                      href={`${accountingIntegration.acumatica_instance_url}/Main?ScreenId=AR301000&ReferenceNbr=${invoice.acumatica_reference_nbr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                    >
                      View in Acumatica: {invoice.acumatica_reference_nbr}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
                <br />
                Contact an administrator to void or reverse this invoice if changes are required.
              </div>
            </div>
          </div>
        </div>
      )}
      
      {invoice.acumatica_reference_nbr && !isAcumaticaReleased && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-blue-600 dark:text-blue-400">Synced to MYOB Acumatica</div>
              <div className="text-sm text-muted-foreground mt-1">
                {accountingIntegration?.acumatica_instance_url ? (
                  <a
                    href={
                      // @ts-ignore - invoice_type exists
                      invoice.invoice_type === 'ap'
                        ? `${accountingIntegration.acumatica_instance_url}/Main?ScreenId=AP301000&ReferenceNbr=${invoice.acumatica_reference_nbr}`
                        : `${accountingIntegration.acumatica_instance_url}/Main?ScreenId=AR301000&ReferenceNbr=${invoice.acumatica_reference_nbr}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {/* @ts-ignore - invoice_type exists */}
                    View {invoice.invoice_type === 'ap' ? 'Bill' : 'Invoice'} in Acumatica: {invoice.acumatica_reference_nbr}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  `Reference: ${invoice.acumatica_reference_nbr}`
                )}
                {/* @ts-ignore - last_synced_at will exist */}
                {(invoice.synced_to_accounting_at || invoice.last_synced_at) && ` • Synced: ${format(new Date(invoice.synced_to_accounting_at || invoice.last_synced_at), "dd MMM yyyy HH:mm")}`}
              </div>
            </div>
            {/* @ts-ignore - invoice_type exists */}
            {invoice.invoice_type !== 'ap' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAcumaticaStatusMutation.mutate()}
                disabled={syncAcumaticaStatusMutation.isPending}
              >
                {syncAcumaticaStatusMutation.isPending ? "Syncing..." : "Sync Status"}
              </Button>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KeyInfoCard
          icon={User}
          // @ts-ignore - invoice_type exists
          label={invoice.invoice_type === 'ap' ? "Supplier" : "Customer"}
          // @ts-ignore - suppliers relation exists
          value={invoice.invoice_type === 'ap' ? (invoice.suppliers?.name || "N/A") : (invoice.customers?.name || "N/A")}
          iconColor="text-primary"
        />
        <KeyInfoCard
          icon={Calendar}
          label="Invoice Date"
          value={format(new Date(invoice.invoice_date), "dd MMM yyyy")}
          description={invoice.due_date ? `Due: ${format(new Date(invoice.due_date), "dd MMM yyyy")}` : undefined}
          iconColor="text-blue-500"
        />
        <KeyInfoCard
          icon={FileText}
          label="Line Items"
          value={lineItems?.lineItems?.length || 0}
          iconColor="text-purple-500"
        />
        <KeyInfoCard
          icon={DollarSign}
          label="Total Amount"
          value={`$${invoice.total_amount.toFixed(2)}`}
          description={`Subtotal: $${invoice.subtotal.toFixed(2)} • Tax: $${invoice.tax_amount.toFixed(2)}`}
          iconColor="text-green-500"
        />
      </div>
    </div>
  );

  // Tabs configuration
  const tabs: TabConfig[] = [
    {
      value: "line-items",
      label: "Line Items",
      icon: <FileText className="h-4 w-4" />,
      content: (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Invoice Line Items</div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recalculateTotalsMutation.mutate()}
                        disabled={recalculateTotalsMutation.isPending}
                      >
                        {recalculateTotalsMutation.isPending ? "Calculating..." : "Recalculate Totals"}
                      </Button>
                      <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Line
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {invoice.notes && (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm">{invoice.notes}</div>
                  </div>
                  <Separator />
                </>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Work Order</TableHead>
                    <TableHead>PO</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Sub-Account</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {canEdit && <TableHead className="w-[100px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems?.lineItems?.map((item: any) => {
                    const sourceKey = `${item.source_type}-${item.source_id}`;
                    const sourceDoc = lineItems.sourceDocuments?.get(sourceKey);

                    return (
                      <InlineInvoiceLineItemRow
                        key={item.id}
                        item={item}
                        sourceDoc={sourceDoc}
                        canEdit={canEdit}
                        onUpdate={() => {
                          queryClient.invalidateQueries({ queryKey: ["invoice-line-items", id] });
                          queryClient.invalidateQueries({ queryKey: ["invoice", id] });
                        }}
                        onDelete={(itemId) => {
                          setItemToDelete(itemId);
                          setDeleteDialogOpen(true);
                        }}
                        onSourceClick={(doc) => {
                          setSelectedSourceId(doc.id);
                          if (doc.type === "project") {
                            setProjectDialogOpen(true);
                          } else {
                            setServiceOrderDialogOpen(true);
                          }
                        }}
                      />
                    );
                  })}
                </TableBody>
              </Table>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({invoice.tax_rate.toFixed(0)}%)</span>
                  <span className="font-medium">${invoice.tax_amount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total Amount</span>
                  <span className="font-bold text-lg text-primary">${invoice.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    },
    // @ts-ignore - Types will update after migration
    ...(invoice.invoice_type === 'AP' ? [{
      value: "po-matching",
      label: "PO Matching",
      icon: <Package className="h-4 w-4" />,
      content: <ThreeWayMatchingCard invoiceId={id!} />,
    }] : []),
    {
      value: "customer",
      label: "Customer",
      icon: <User className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Customer Name</div>
              <div className="font-medium">{invoice.customers?.name}</div>
            </div>
            {invoice.customers?.email && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Email</div>
                {/* @ts-ignore - invoice_type and suppliers exists */}
                <div className="text-sm">{invoice.invoice_type === 'ap' ? invoice.suppliers.email : invoice.customers.email}</div>
              </div>
            )}
            {/* @ts-ignore - invoice_type exists */}
            {invoice.invoice_type === 'ar' && invoice.customers?.billing_address && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Billing Address</div>
                <div className="text-sm">{invoice.customers.billing_address}</div>
              </div>
            )}
            {/* @ts-ignore - invoice_type and suppliers exists */}
            {invoice.invoice_type === 'ap' && invoice.suppliers?.acumatica_supplier_id && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Acumatica Supplier ID</div>
                {/* @ts-ignore - suppliers exists */}
                <div className="text-sm font-mono">{invoice.suppliers.acumatica_supplier_id}</div>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "tasks",
      label: "Tasks",
      content: (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Linked Tasks</CardTitle>
              <CreateTaskButton
                linkedModule="invoice"
                linkedRecordId={id!}
                variant="default"
                size="sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <LinkedTasksList linkedModule="invoice" linkedRecordId={id!} />
          </CardContent>
        </Card>
      ),
    },
    {
      value: "helpdesk",
      label: "Help Desk",
      icon: <Mail className="h-4 w-4" />,
      content: <LinkedHelpdeskTicketsTab documentType="invoice" documentId={id!} />,
    },
    {
      value: "linked-documents",
      label: "Linked Documents",
      icon: <FileText className="h-4 w-4" />,
      content: <LinkedDocumentsTimeline documentType="invoice" documentId={id!} />,
    },
    {
      value: "history",
      label: "History",
      icon: <Clock className="h-4 w-4" />,
      content: <AuditTimeline tableName="invoices" recordId={id!} />,
    },
  ];

  return (
    <>
      <DocumentDetailLayout
        title={`Invoice ${invoice.invoice_number}`}
        subtitle="View and manage invoice details"
        backPath="/invoices"
        statusBadges={statusBadges}
        primaryActions={primaryActions}
        keyInfoSection={keyInfoSection}
        tabs={tabs}
        auditTableName="invoices"
        auditRecordId={id!}
      />

      {editingItem && (
        <EditInvoiceLineDialog
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          lineItem={editingItem}
          isFromSource={!!editingItem.source_id}
          onSave={(updatedItem) => {
            updateLineItemMutation.mutate({
              itemId: editingItem.id,
              updates: updatedItem,
              isFromSource: !!editingItem.source_id,
            });
            setEditingItem(null);
          }}
        />
      )}

      <AddInvoiceLineDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={(newItem) => addLineItemMutation.mutate(newItem)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Line Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this line item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  deleteLineItemMutation.mutate(itemToDelete);
                  setItemToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteInvoiceDialogOpen} onOpenChange={setDeleteInvoiceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive invoice {invoice?.invoice_number}? This will hide the invoice from the active invoices list. You can restore it later from the archived invoices view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveInvoiceMutation.mutate()}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Archive Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedSourceId && (
        <>
          <ServiceOrderDialog
            open={serviceOrderDialogOpen}
            onOpenChange={(open) => {
              setServiceOrderDialogOpen(open);
              if (!open) setSelectedSourceId(null);
            }}
            orderId={selectedSourceId}
          />
          <ProjectDialog
            open={projectDialogOpen}
            onOpenChange={(open) => {
              setProjectDialogOpen(open);
              if (!open) setSelectedSourceId(null);
            }}
            projectId={selectedSourceId}
          />
        </>
      )}
    </>
  );
}
