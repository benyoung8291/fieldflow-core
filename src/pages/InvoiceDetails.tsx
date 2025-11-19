import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DocumentDetailLayout, { StatusBadge, DocumentAction, FileMenuAction, TabConfig } from "@/components/layout/DocumentDetailLayout";
import KeyInfoCard from "@/components/layout/KeyInfoCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, CheckCircle, Download, Plus, Edit, Trash2, Check, ExternalLink, DollarSign, Calendar, FileText, User, Mail, ListChecks, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import EditInvoiceLineDialog from "@/components/invoices/EditInvoiceLineDialog";
import AddInvoiceLineDialog from "@/components/invoices/AddInvoiceLineDialog";
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
          )
        `)
        .eq("id", id)
        .single();

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
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      // If status is approved, trigger integration sync
      if (status === "approved") {
        // Call edge function to sync with accounting systems
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-invoice-to-accounting`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ invoice_id: id }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "invoices", id] });
      toast.success("Invoice status updated successfully");
    },
    onError: () => {
      toast.error("Failed to update invoice status");
    },
  });

  const updateLineItemMutation = useMutation({
    mutationFn: async ({ itemId, updates, isFromSource }: { itemId: string; updates: any; isFromSource: boolean }) => {
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
        const taxAmount = subtotal * (invoice?.tax_rate || 0);
        const totalAmount = subtotal + taxAmount;

        await supabase
          .from("invoices")
          .update({
            subtotal,
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
        const taxAmount = subtotal * (invoice?.tax_rate || 0);
        const totalAmount = subtotal + taxAmount;

        await supabase
          .from("invoices")
          .update({
            subtotal,
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
      const taxAmount = subtotal * (invoice?.tax_rate || 0);
      const totalAmount = subtotal + taxAmount;

      await supabase
        .from("invoices")
        .update({
          subtotal,
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

  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get invoice line items to potentially update source documents
      const { data: invoiceLineItems } = await supabase
        .from("invoice_line_items")
        .select("source_type, source_id, line_item_id")
        .eq("invoice_id", id);

      // Group by source document to update billing status
      const sourceDocUpdates = new Map<string, { type: string; id: string; lineItemIds: string[] }>();
      
      invoiceLineItems?.forEach(item => {
        if (item.source_id && item.source_type && item.line_item_id) {
          const key = `${item.source_type}-${item.source_id}`;
          if (!sourceDocUpdates.has(key)) {
            sourceDocUpdates.set(key, {
              type: item.source_type,
              id: item.source_id,
              lineItemIds: []
            });
          }
          sourceDocUpdates.get(key)!.lineItemIds.push(item.line_item_id);
        }
      });

      // Delete line items first (foreign key constraint)
      const { error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", id);

      if (lineItemsError) throw lineItemsError;

      // Delete the invoice
      const { error: invoiceError } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id);

      if (invoiceError) throw invoiceError;

      // Update billing status of source documents
      // Check if there are other invoices referencing the same source documents
      for (const [key, doc] of sourceDocUpdates.entries()) {
        const { data: remainingInvoices } = await supabase
          .from("invoice_line_items")
          .select("invoice_id")
          .eq("source_type", doc.type)
          .eq("source_id", doc.id)
          .limit(1);

        // If no other invoices reference this source, reset billing status
        if (!remainingInvoices || remainingInvoices.length === 0) {
          if (doc.type === "service_order") {
            await supabase
              .from("service_orders")
              .update({ billing_status: "not_billed" })
              .eq("id", doc.id);
          } else if (doc.type === "project") {
            await supabase
              .from("projects")
              .update({ billing_status: "not_billed" })
              .eq("id", doc.id);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Invoice deleted successfully");
      navigate("/invoices");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to delete invoice");
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
  ];

  // Primary actions configuration
  const primaryActions: DocumentAction[] = [];
  
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
    primaryActions.push({
      label: "Send to Customer",
      icon: <Send className="h-4 w-4" />,
      onClick: () => updateStatusMutation.mutate("sent"),
      variant: "default",
    });
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
  } else if (invoice.status === "approved") {
    primaryActions.push({
      label: "Unapprove",
      onClick: () => updateStatusMutation.mutate("sent"),
      variant: "outline",
    });
  }

  primaryActions.push({
    label: "Download PDF",
    icon: <Download className="h-4 w-4" />,
    onClick: () => {},
    variant: "outline",
  });

  // File menu actions configuration
  const fileMenuActions: FileMenuAction[] = [
    {
      label: "Delete Invoice",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => setDeleteInvoiceDialogOpen(true),
      destructive: true,
    },
  ];

  // Key info section
  const keyInfoSection = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <KeyInfoCard
        icon={User}
        label="Customer"
        value={invoice.customers?.name || "N/A"}
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
        description={`Subtotal: $${invoice.subtotal.toFixed(2)}`}
        iconColor="text-green-500"
      />
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
                {invoice.status === "draft" && (
                  <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Line
                  </Button>
                )}
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
                    <TableHead>Project Date</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {invoice.status === "draft" && <TableHead className="w-[100px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems?.lineItems?.map((item: any) => {
                    const sourceKey = `${item.source_type}-${item.source_id}`;
                    const sourceDoc = lineItems.sourceDocuments?.get(sourceKey);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div>{item.description}</div>
                            {sourceDoc && (
                              <button
                                onClick={() => {
                                  setSelectedSourceId(sourceDoc.id);
                                  if (sourceDoc.type === "project") {
                                    setProjectDialogOpen(true);
                                  } else {
                                    setServiceOrderDialogOpen(true);
                                  }
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground mt-1 hover:text-primary transition-colors group"
                              >
                                {sourceDoc.type === "project" ? (
                                  <>
                                    <span>from Project: {sourceDoc.name}</span>
                                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </>
                                ) : (
                                  <>
                                    <span>from {sourceDoc.order_number} - {sourceDoc.title}</span>
                                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sourceDoc?.type === "service_order" && sourceDoc.work_order_number
                            ? sourceDoc.work_order_number
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sourceDoc?.type === "service_order" && sourceDoc.purchase_order_number
                            ? sourceDoc.purchase_order_number
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sourceDoc?.type === "project" && sourceDoc.start_date
                            ? format(new Date(sourceDoc.start_date), "dd MMM yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${item.line_total.toFixed(2)}
                        </TableCell>
                        {invoice.status === "draft" && (
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingItem({ ...item, source_type: item.source_type, source_id: item.source_id })}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setItemToDelete(item.id);
                                  setDeleteDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
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
                <div className="text-sm">{invoice.customers.email}</div>
              </div>
            )}
            {invoice.customers?.billing_address && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Billing Address</div>
                <div className="text-sm">{invoice.customers.billing_address}</div>
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
        fileMenuActions={fileMenuActions}
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
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice {invoice?.invoice_number}? This will permanently remove the invoice and all its line items. Source documents will have their billing status reset if no other invoices reference them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteInvoiceMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Invoice
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
