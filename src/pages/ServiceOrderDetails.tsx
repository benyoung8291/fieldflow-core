import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, User, FileText, DollarSign, Clock, Edit, Mail, Phone, CheckCircle, XCircle, Receipt, Plus, FolderKanban, Copy, Trash2, History, Paperclip, ShoppingCart } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import DocumentDetailLayout, { DocumentAction, FileMenuAction, StatusBadge, TabConfig } from "@/components/layout/DocumentDetailLayout";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";
import ServiceOrderAttachments from "@/components/service-orders/ServiceOrderAttachments";
import ServiceOrderPurchaseOrdersTab from "@/components/service-orders/ServiceOrderPurchaseOrdersTab";
import ServiceOrderProfitLossCard from "@/components/service-orders/ServiceOrderProfitLossCard";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import AuditTimeline from "@/components/audit/AuditTimeline";
import AppointmentsTab from "@/components/service-orders/AppointmentsTab";
import { LinkedHelpdeskTicketsTab } from "@/components/helpdesk/LinkedHelpdeskTicketsTab";
import { LinkedDocumentsTimeline } from "@/components/audit/LinkedDocumentsTimeline";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RelatedInvoicesCard from "@/components/invoices/RelatedInvoicesCard";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

const statusLabels: Record<string, string> = {
  draft: "Waiting",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export default function ServiceOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createAppointmentDialogOpen, setCreateAppointmentDialogOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [appointmentStartTime, setAppointmentStartTime] = useState("09:00");
  const [appointmentEndTime, setAppointmentEndTime] = useState("17:00");
  const [addToInvoiceDialogOpen, setAddToInvoiceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [purchaseOrderDialogOpen, setPurchaseOrderDialogOpen] = useState(false);

  // Fetch project integration setting
  const { data: integrationSettings } = useQuery({
    queryKey: ["project-integration-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings" as any)
        .select("projects_service_orders_integration")
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as unknown as { projects_service_orders_integration: boolean } | null;
    },
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ["service_order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name, email, phone),
          customer_locations!service_orders_customer_location_id_fkey(name, address, city, state, postcode),
          customer_contacts(first_name, last_name, email, phone),
          projects(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ["service-order-line-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_line_items")
        .select("*")
        .eq("service_order_id", id)
        .order("item_order");

      if (error) throw error;
      return data;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["service-order-appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("service_order_id", id);
      if (error) throw error;
      return data;
    },
  });

  const { data: draftInvoices = [] } = useQuery({
    queryKey: ["draft_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customers(name)")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  const totalCost = lineItems.reduce((sum: number, item: any) => sum + (item.cost_price || 0) * item.quantity, 0);
  const totalRevenue = lineItems.reduce((sum: number, item: any) => sum + item.line_total, 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const allAppointmentsCompleteOrCancelled = appointments.length > 0 && 
    appointments.every((apt: any) => apt.status === "completed" || apt.status === "cancelled");

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (status: "draft" | "scheduled" | "in_progress" | "completed" | "cancelled") => {
      const { error } = await supabase
        .from("service_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_order", id] });
      setCompleteConfirmOpen(false);
      toast({ title: "Service order status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  const handleCompleteOrder = () => {
    if (!allAppointmentsCompleteOrCancelled && appointments.length > 0) {
      toast({ 
        title: "Cannot complete order", 
        description: "All appointments must be completed or cancelled first",
        variant: "destructive"
      });
      return;
    }
    setCompleteConfirmOpen(true);
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      const startDateTime = new Date(`${appointmentDate}T${appointmentStartTime}`);
      const endDateTime = new Date(`${appointmentDate}T${appointmentEndTime}`);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      
      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from("appointments")
        .insert({
          title: order?.title || "Appointment",
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "draft" as const,
          created_by: user.id,
          tenant_id: profile.tenant_id,
          service_order_id: id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-appointments", id] });
      setCreateAppointmentDialogOpen(false);
      toast({ title: "Appointment created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating appointment", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const deleteServiceOrderMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // First check if this service order was created from a quote
      const { data: quoteData } = await supabase
        .from("quotes")
        .select("id")
        .eq("converted_to_service_order_id", id)
        .maybeSingle();

      // Delete the service order
      const { error: deleteError } = await supabase
        .from("service_orders")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // If there was a linked quote, unlock it
      if (quoteData) {
        const { error: quoteError } = await supabase
          .from("quotes")
          .update({ converted_to_service_order_id: null })
          .eq("id", quoteData.id);

        if (quoteError) throw quoteError;

        // Add audit log for unlocking the quote
        const userName = user.user_metadata?.first_name 
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
          : user.email?.split("@")[0] || "System";

        await supabase.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: user.id,
          user_name: userName,
          table_name: "quotes",
          record_id: quoteData.id,
          action: "update",
          field_name: "converted_to_service_order",
          old_value: id,
          new_value: null,
          note: `Service Order deleted - Quote unlocked for editing (Service Order: ${order?.order_number || id})`,
        });

        // Create unlock version snapshot
        const { data: quoteDetails } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", quoteData.id)
          .single();

        const { data: quoteLineItems } = await supabase
          .from("quote_line_items")
          .select("*")
          .eq("quote_id", quoteData.id)
          .order("item_order");

        if (quoteDetails) {
          const { data: existingVersions } = await supabase
            .from("quote_versions")
            .select("version_number")
            .eq("quote_id", quoteData.id)
            .order("version_number", { ascending: false })
            .limit(1);

          const nextVersion = existingVersions && existingVersions.length > 0 
            ? existingVersions[0].version_number + 1 
            : 1;

          await supabase.from("quote_versions").insert({
            quote_id: quoteData.id,
            version_number: nextVersion,
            title: quoteDetails.title,
            description: quoteDetails.description,
            subtotal: quoteDetails.subtotal,
            tax_rate: quoteDetails.tax_rate || 0,
            tax_amount: quoteDetails.tax_amount,
            discount_amount: 0,
            total_amount: quoteDetails.total_amount,
            quote_type: 'unlock',
            line_items: quoteLineItems || [],
            notes: quoteDetails.notes,
            terms_conditions: quoteDetails.terms_conditions,
            changed_by: user.id,
            change_description: `Quote unlocked - Service Order ${order?.order_number || id} was deleted`,
          } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_orders"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Service order deleted successfully" });
      navigate("/service-orders");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting service order", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const addToInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();
      
      if (!profile) throw new Error("Profile not found");

      const invoiceLineItems = lineItems.map((item: any) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        source_type: "service_order",
        source_id: id,
        line_item_id: item.id,
        item_order: item.item_order,
        tenant_id: profile.tenant_id,
      }));

      const { error: insertError } = await supabase
        .from("invoice_line_items")
        .insert(invoiceLineItems);
      
      if (insertError) throw insertError;

      const { data: invoice } = await supabase
        .from("invoices")
        .select("invoice_number, subtotal, tax_rate")
        .eq("id", invoiceId)
        .single();

      const oldSubtotal = invoice?.subtotal || 0;
      const lineItemsTotal = lineItems.reduce((sum: number, item: any) => sum + item.line_total, 0);
      const newSubtotal = oldSubtotal + lineItemsTotal;
      const taxAmount = newSubtotal * ((invoice?.tax_rate || 0) / 100);
      const totalAmount = newSubtotal + taxAmount;

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          subtotal: newSubtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq("id", invoiceId);
      
      if (updateError) throw updateError;

      // Create audit log entry for the service order showing it was added to invoice
      const userName = `${profile.first_name} ${profile.last_name || ''}`.trim();
      await supabase
        .from("audit_logs")
        .insert({
          tenant_id: profile.tenant_id,
          user_id: user.id,
          user_name: userName,
          table_name: 'service_orders',
          record_id: id,
          action: 'update',
          field_name: 'billing_status',
          old_value: order?.billing_status || 'not_billed',
          new_value: 'partially_billed',
          note: `Added ${lineItems.length} line item(s) to invoice ${invoice?.invoice_number || invoiceId}. Total amount: $${lineItemsTotal.toFixed(2)}. Link: /invoices/${invoiceId}`,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_order", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "service_orders", id] });
      setAddToInvoiceDialogOpen(false);
      toast({ title: "Service order added to invoice" });
    },
    onError: (error: any) => {
      toast({ title: "Error adding to invoice", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading || !order) {
    return (
      <DocumentDetailLayout
        title="Loading..."
        backPath="/service-orders"
        tabs={[]}
        isLoading={isLoading}
        notFoundMessage={!isLoading && !order ? "Order not found" : undefined}
      />
    );
  }

  // Status badges configuration
  const statusBadges: StatusBadge[] = [
    {
      label: statusLabels[order?.status as keyof typeof statusLabels] || order?.status.replace('_', ' ') || '',
      variant: "outline",
      className: statusColors[order?.status as keyof typeof statusColors] || 'bg-muted text-muted-foreground',
    },
    {
      label: order?.priority || '',
      variant: "outline",
      className: priorityColors[order?.priority as keyof typeof priorityColors] || 'bg-muted text-muted-foreground',
    },
    {
      label: (order as any)?.billing_status?.replace('_', ' ') || 'not billed',
      variant: "outline",
      className: (order as any)?.billing_status === 'billed' ? 'bg-success/10 text-success' :
                 (order as any)?.billing_status === 'partially_billed' ? 'bg-warning/10 text-warning' :
                 'bg-muted text-muted-foreground',
    },
  ];

  // Primary actions
  const primaryActions: DocumentAction[] = [
    {
      label: "Complete Order",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: handleCompleteOrder,
      variant: "default",
      show: order?.status !== "completed",
    },
    {
      label: "Run Billing",
      icon: <Receipt className="h-4 w-4" />,
      onClick: () => navigate("/invoices/create", { state: { serviceOrderId: id } }),
      variant: "outline",
      show: order?.status === "completed" && order?.billing_status !== "billed",
    },
    {
      label: "Add to Draft Invoice",
      icon: <FileText className="h-4 w-4" />,
      onClick: () => setAddToInvoiceDialogOpen(true),
      variant: "outline",
      show: order?.status === "completed" && order?.billing_status !== "billed",
    },
  ];

  // File menu actions
  const fileMenuActions: FileMenuAction[] = [
    {
      label: "Edit Order",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => setDialogOpen(true),
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-4 w-4" />,
      onClick: () => {/* Duplicate order */},
    },
    {
      label: "Set to Waiting",
      onClick: () => updateOrderStatusMutation.mutate("draft"),
      separator: true,
    },
    {
      label: "Cancel Order",
      icon: <XCircle className="h-4 w-4" />,
      onClick: () => updateOrderStatusMutation.mutate("cancelled"),
      destructive: false,
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleDelete,
      destructive: true,
      separator: true,
    },
  ];

  // Key information section
  const keyInfoSection = (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Customer & Location Info */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Customer & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{order.customers?.name}</div>
                  {order.customers?.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Mail className="h-3 w-3" />
                      {order.customers.email}
                    </div>
                  )}
                  {order.customers?.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Phone className="h-3 w-3" />
                      {order.customers.phone}
                    </div>
                  )}
                </div>
              </div>

              {order.customer_locations && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{order.customer_locations.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {order.customer_locations.address}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.customer_locations.city}, {order.customer_locations.state} {order.customer_locations.postcode}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total</div>
                  <div className="text-2xl font-bold">
                    ${((order as any).total_amount || (totalRevenue + ((order as any).tax_amount || 0))).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Subtotal: ${((order as any).subtotal || totalRevenue).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tax ({((order as any).tax_rate || 0).toFixed(1)}%): ${((order as any).tax_amount || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Profit</div>
                  <div className="text-2xl font-bold text-success">
                    ${totalProfit.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Margin: {profitMargin.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Costs: ${totalCost.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hours Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Estimated</div>
                  <div className="text-lg font-semibold">
                    {(order as any)?.estimated_hours ? `${Number((order as any).estimated_hours).toFixed(1)} hrs` : "N/A"}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-xs text-muted-foreground">Scheduled</div>
                  <div className="text-lg font-semibold">
                    {(() => {
                      const totalHours = appointments.reduce((sum: number, apt: any) => {
                        if (apt.start_time && apt.end_time) {
                          const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
                          return sum + hours;
                        }
                        return sum;
                      }, 0);
                      return totalHours > 0 ? `${totalHours.toFixed(1)} hrs` : "0 hrs";
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Assignment - Only show if integration is enabled */}
          {integrationSettings?.projects_service_orders_integration && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Project</CardTitle>
              </CardHeader>
              <CardContent>
                {(order as any).projects ? (
                  <div 
                    className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 -mx-3 -mt-3 -mb-3 p-3 rounded-lg transition-colors"
                    onClick={() => navigate(`/projects/${(order as any).projects.id}`)}
                  >
                    <FolderKanban className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{(order as any).projects.name}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No project assigned
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Profit & Loss Card */}
          <div className="lg:col-span-2">
            <ServiceOrderProfitLossCard
              totalRevenue={totalRevenue}
              actualCost={(order as any)?.actual_cost || 0}
              costOfMaterials={(order as any)?.cost_of_materials || 0}
              costOfLabor={(order as any)?.cost_of_labor || 0}
              otherCosts={(order as any)?.other_costs || 0}
              profitMargin={(order as any)?.profit_margin || 0}
            />
          </div>
    </div>
  );

  // Tabs configuration
  const tabs: TabConfig[] = [
    {
      value: "details",
      label: "Details",
      icon: <FileText className="h-4 w-4" />,
      content: (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Work Order #</div>
                      <div className="text-sm font-medium">{(order as any).work_order_number || "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Purchase Order #</div>
                      <div className="text-sm font-medium">{(order as any).purchase_order_number || "N/A"}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Preferred Start Date
                      </div>
                      <div className="text-sm">
                        {(order as any).preferred_date_start ? format(new Date((order as any).preferred_date_start), "PPP") : "Not set"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Preferred End Date
                      </div>
                      <div className="text-sm">
                        {(order as any).preferred_date_end ? format(new Date((order as any).preferred_date_end), "PPP") : "Not set"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Estimated Hours
                      </div>
                      <div className="text-sm">{(order as any).estimated_hours ? `${Number((order as any).estimated_hours).toFixed(1)} hrs` : "Not set"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Billing Type</div>
                      <div className="text-sm">{(order as any).billing_type || "N/A"}</div>
                    </div>
                  </div>

                  {(order as any).skill_required && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Skills Required</div>
                      <div className="text-sm">{(order as any).skill_required}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Description
                    </div>
                    <div className="text-sm">{order.description || "No description"}</div>
                  </div>

                  {(order as any).is_recurring && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Recurring</div>
                      <div className="text-sm">
                        Pattern: {(order as any).recurrence_pattern || "N/A"}
                        {(order as any).recurrence_frequency && ` (Every ${(order as any).recurrence_frequency} ${(order as any).recurrence_pattern}${(order as any).recurrence_frequency > 1 ? 's' : ''})`}
                        {(order as any).recurrence_end_date && ` until ${format(new Date((order as any).recurrence_end_date), "PPP")}`}
                      </div>
                    </div>
                  )}
                  
                  {(order as any).completed_date && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Completed Date</div>
                      <div className="text-sm">{format(new Date((order as any).completed_date), "PPP")}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.customer_locations && (
                    <>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Site Address</div>
                        <div className="text-sm">
                          {order.customer_locations.address}
                          {order.customer_locations.city && <>, {order.customer_locations.city}</>}
                          {order.customer_locations.state && <> {order.customer_locations.state}</>}
                          {order.customer_locations.postcode && <> {order.customer_locations.postcode}</>}
                        </div>
                      </div>
                    </>
                  )}
                  {order.customer_contacts && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Site Contact</div>
                      <div className="text-sm font-medium">
                        {order.customer_contacts.first_name} {order.customer_contacts.last_name}
                      </div>
                      {order.customer_contacts.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Mail className="h-3 w-3" />
                          {order.customer_contacts.email}
                        </div>
                      )}
                      {order.customer_contacts.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          {order.customer_contacts.phone}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
      ),
    },
    {
      value: "appointments",
      label: "Appointments & Time",
      icon: <Calendar className="h-4 w-4" />,
      badge: appointments?.length || 0,
      content: (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Appointments & Time Logs</CardTitle>
            <Button size="sm" onClick={() => setCreateAppointmentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Appointment
            </Button>
          </CardHeader>
          <CardContent>
            <AppointmentsTab serviceOrderId={id!} />
          </CardContent>
        </Card>
      ),
    },
    {
      value: "items",
      label: "Line Items",
      icon: <FileText className="h-4 w-4" />,
      badge: lineItems?.length || 0,
      content: (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No line items added yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${item.unit_price?.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.line_total?.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
      ),
    },
    {
      value: "attachments",
      label: "Attachments",
      icon: <Paperclip className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceOrderAttachments serviceOrderId={id!} />
          </CardContent>
        </Card>
      ),
    },
    {
      value: "invoices",
      label: "Invoices",
      icon: <Receipt className="h-4 w-4" />,
      content: <RelatedInvoicesCard sourceType="service_order" sourceId={id!} />,
    },
    {
      value: "purchase-orders",
      label: "Purchase Orders",
      icon: <ShoppingCart className="h-4 w-4" />,
      content: <ServiceOrderPurchaseOrdersTab serviceOrderId={id!} onCreatePO={() => setPurchaseOrderDialogOpen(true)} />,
    },
    {
      value: "tasks",
      label: "Tasks",
      icon: <CheckCircle className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tasks</CardTitle>
              <CreateTaskButton
                linkedModule="service_order"
                linkedRecordId={id!}
                variant="default"
                size="sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <LinkedTasksList linkedModule="service_order" linkedRecordId={id!} />
          </CardContent>
        </Card>
      ),
    },
    {
      value: "helpdesk",
      label: "Help Desk",
      icon: <Mail className="h-4 w-4" />,
      content: <LinkedHelpdeskTicketsTab documentType="service_order" documentId={id!} />,
    },
    {
      value: "linked-documents",
      label: "Linked Documents",
      icon: <FileText className="h-4 w-4" />,
      content: <LinkedDocumentsTimeline documentType="service_order" documentId={id!} />,
    },
    {
      value: "history",
      label: "History",
      icon: <History className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit History</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline tableName="service_orders" recordId={id!} />
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <>
      <DocumentDetailLayout
        title={`Service Order ${order?.order_number || ''}`}
        subtitle={order?.title}
        backPath="/service-orders"
        statusBadges={statusBadges}
        primaryActions={primaryActions}
        fileMenuActions={fileMenuActions}
        auditTableName="service_orders"
        auditRecordId={id!}
        keyInfoSection={keyInfoSection}
        tabs={tabs}
        defaultTab="details"
        isLoading={isLoading}
        notFoundMessage={!order ? "Order not found" : undefined}
      />

      <ServiceOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderId={id}
      />

      {/* Create Appointment Dialog */}
      <AlertDialog open={createAppointmentDialogOpen} onOpenChange={setCreateAppointmentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new appointment for {order?.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={appointmentStartTime}
                  onChange={(e) => setAppointmentStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={appointmentEndTime}
                  onChange={(e) => setAppointmentEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => createAppointmentMutation.mutate()}>
              Create Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Order Confirmation */}
      <AlertDialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Service Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this service order as completed? This will allow the order to be invoiced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateOrderStatusMutation.mutate("completed")}>
              Complete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service order? This action cannot be undone.
              The original quote (if any) will be unlocked for editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteServiceOrderMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Invoice Dialog */}
      <AlertDialog open={addToInvoiceDialogOpen} onOpenChange={setAddToInvoiceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add to Existing Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Select a draft invoice to add this service order's line items to
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select 
              onValueChange={(invoiceId) => {
                addToInvoiceMutation.mutate(invoiceId);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select draft invoice" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {draftInvoices.map((invoice: any) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.customers?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
