import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, User, FileText, DollarSign, Clock, Edit, Mail, Phone, CheckCircle, XCircle, Receipt, Plus, FolderKanban, Copy, Trash2, History, Paperclip, ShoppingCart, UserPlus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import DocumentDetailLayout, { DocumentAction, StatusBadge, TabConfig } from "@/components/layout/DocumentDetailLayout";
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
import ContactSelectorDialog from "@/components/customers/ContactSelectorDialog";
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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [purchaseOrderDialogOpen, setPurchaseOrderDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");

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
          service_contracts!service_orders_contract_id_fkey(id, contract_number, title),
          projects(id, name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      
      // Fetch contact separately if contact_id exists
      if (data?.customer_contact_id) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, mobile, position")
          .eq("id", data.customer_contact_id)
          .single();
        return { ...data, contacts: contact };
      }
      
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

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["service-order-purchase-orders", id],
    queryFn: async () => {
      // @ts-ignore - Complex Supabase types cause TS depth issues
      const user = await supabase.auth.getUser();
      // @ts-ignore
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.data.user?.id)
        .single();

      if (!profile?.tenant_id) return [];

      const posResult: any = await supabase
        .rpc('get_all_purchase_orders', { p_tenant_id: profile.tenant_id });
      
      if (posResult.error) throw posResult.error;
      
      // Filter for service_order_id match
      const filteredPos = (posResult.data as any[])?.filter((po: any) => po.service_order_id === id) || [];
      
      if (filteredPos.length === 0) return [];

      // Fetch line items separately
      const lineItemsQuery: any = await (supabase as any)
        .from("purchase_order_line_items")
        .select("*")
        .in("purchase_order_id", filteredPos.map((po: any) => po.id));
      const lineItems = lineItemsQuery.data;

      // Merge line items with POs
      return filteredPos.map((po: any) => ({
        ...po,
        purchase_order_line_items: lineItems?.filter((li: any) => li.purchase_order_id === po.id) || []
      }));
    },
  });

  // Fetch AP invoices linked to this service order (directly or via PO)
  const { data: apInvoices = [] } = useQuery({
    queryKey: ["service-order-ap-invoices", id],
    queryFn: async () => {
      if (!id) return [];
      
      // Get AP invoices directly linked to service order
      // @ts-ignore - Supabase types can be excessively deep
      const { data: directInvoices, error: directError } = await supabase
        .from("ap_invoices")
        .select("id, invoice_number, total_amount, subtotal, status, service_order_id, invoice_date, suppliers(name)")
        .eq("service_order_id", id);
      
      if (directError) throw directError;
      
      // Get AP invoices linked via purchase receipt → purchase order → service order
      // First get POs for this service order
      // @ts-ignore
      const { data: pos } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("service_order_id", id);
      
      if (!pos || pos.length === 0) return directInvoices || [];
      
      // Get receipts for those POs
      // @ts-ignore
      const { data: receipts } = await supabase
        .from("po_receipts")
        .select("id")
        .in("po_id", pos.map((po: any) => po.id));
      
      if (!receipts || receipts.length === 0) return directInvoices || [];
      
      // Get AP invoices for those receipts
      // @ts-ignore
      const { data: indirectInvoices, error: indirectError } = await supabase
        .from("ap_invoices")
        .select("id, invoice_number, total_amount, subtotal, status, purchase_receipt_id, invoice_date, suppliers(name)")
        .in("purchase_receipt_id", receipts.map((r: any) => r.id));
      
      if (indirectError) throw indirectError;
      
      // Combine and deduplicate
      const allInvoices = [...(directInvoices || []), ...(indirectInvoices || [])];
      const uniqueInvoices = Array.from(new Map(allInvoices.map((inv: any) => [inv.id, inv])).values());
      
      return uniqueInvoices;
    },
  });

  // Fetch AR invoices
  const { data: arInvoices = [] } = useQuery({
    queryKey: ["service-order-ar-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name)")
        .eq("service_order_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  const totalCost = lineItems.reduce((sum: number, item: any) => sum + (item.cost_price || 0) * item.quantity, 0);
  const totalRevenue = lineItems.reduce((sum: number, item: any) => sum + item.line_total, 0);
  
  // Calculate AP invoice costs (approved AP invoices linked to this service order)
  const apInvoiceCosts = apInvoices
    .filter((invoice: any) => invoice.status === 'approved')
    .reduce((sum: number, invoice: any) => sum + (invoice.subtotal || 0), 0);
  
  // Total actual cost includes line item costs + AP invoice costs
  const actualCost = totalCost + apInvoiceCosts;
  const totalProfit = totalRevenue - actualCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Calculate pending purchase order costs (draft and approved POs not yet received)
  const pendingPOCosts = purchaseOrders
    .filter((po: any) => po.status === 'draft' || po.status === 'approved')
    .reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0);

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
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Insert line items into the selected invoice
      const lineItemsToAdd = lineItems.map((item: any) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        cost_price: item.cost_price,
        tenant_id: profile.tenant_id,
      }));

      const { error } = await supabase
        .from("invoice_line_items")
        .insert(lineItemsToAdd);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setAddToInvoiceDialogOpen(false);
      toast({ title: "Line items added to invoice" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error adding to invoice", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleCreateInvoice = () => {
    if (!order) return;
    navigate("/invoices/new", { 
      state: { 
        serviceOrderId: id 
      } 
    });
  };

  if (isLoading || !order) {
    return <div>Loading...</div>;
  }

  const statusBadges: StatusBadge[] = [
    { label: statusLabels[order.status] || order.status, variant: "default", className: statusColors[order.status as keyof typeof statusColors] },
    { label: order.priority.charAt(0).toUpperCase() + order.priority.slice(1), variant: "outline", className: priorityColors[order.priority as keyof typeof priorityColors] },
  ];

  const primaryActions: DocumentAction[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => setDialogOpen(true),
      variant: "outline",
    },
  ];

  const secondaryActions: DocumentAction[] = [
    {
      label: "Create Invoice",
      icon: <Receipt className="h-4 w-4" />,
      onClick: handleCreateInvoice,
    },
    {
      label: "Add to Invoice",
      icon: <Plus className="h-4 w-4" />,
      onClick: () => setAddToInvoiceDialogOpen(true),
    },
    {
      label: "Create PO",
      icon: <ShoppingCart className="h-4 w-4" />,
      onClick: () => setPurchaseOrderDialogOpen(true),
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-4 w-4" />,
      onClick: () => console.log("duplicate"),
    },
    {
      label: "Complete Order",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: handleCompleteOrder,
    },
    {
      label: "Cancel Order",
      icon: <XCircle className="h-4 w-4" />,
      onClick: () => setCancelConfirmOpen(true),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleDelete,
      variant: "destructive",
    },
  ];

  const costBreakdown = {
    materials: totalCost,
    labor: 0,
    other: 0,
  };

  const keyInfoSection = (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Customer Details */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div 
                className="cursor-pointer hover:bg-muted/50 -mx-3 -mt-3 -mb-3 p-3 rounded-lg transition-colors"
                onClick={() => navigate(`/customers/${order.customer_id}`)}
              >
                <div className="font-medium text-sm">{order.customers?.name}</div>
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
            </CardContent>
          </Card>

          {/* Location & Contact */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              {order.customer_locations ? (
                <div>
                  <div className="text-sm font-medium mb-1">{order.customer_locations.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.customer_locations.address}
                    {order.customer_locations.city && <>, {order.customer_locations.city}</>}
                    {order.customer_locations.state && <> {order.customer_locations.state}</>}
                    {order.customer_locations.postcode && <> {order.customer_locations.postcode}</>}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No location</div>
              )}

              <Separator />

              {/* Contact Section */}
              {(() => {
                const contact = (order as any).contacts;
                return (
                <>
                  <div className="text-xs font-medium text-muted-foreground">Contact</div>
                  {contact ? (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {contact.first_name} {contact.last_name}
                          </div>
                          {contact.position && (
                            <div className="text-xs text-muted-foreground">{contact.position}</div>
                          )}
                          {contact.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </div>
                          )}
                          {(contact.phone || contact.mobile) && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" />
                              {contact.mobile || contact.phone}
                            </div>
                          )}
                        </div>
                      </div>
                  ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setContactDialogOpen(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Link or Create Contact
                      </Button>
                  )}
                </>
              );
            })()}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
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
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
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

          {/* Schedule Information */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">Preferred Service Date</div>
                <div className="bg-primary/10 border-l-4 border-primary px-3 py-2.5 rounded-md">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-semibold text-primary">
                      {order.preferred_date
                        ? format(new Date(order.preferred_date), "PPP")
                        : "Not specified"}
                    </span>
                  </div>
                </div>
              </div>

              {((order as any).date_range_start || (order as any).date_range_end) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Alternative Date Window</div>
                  <div className="bg-muted/50 border border-border px-3 py-2.5 rounded-md">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="text-sm font-medium">
                        {(order as any).date_range_start && format(new Date((order as any).date_range_start), "PP")}
                        {(order as any).date_range_start && (order as any).date_range_end && (
                          <span className="mx-2 text-muted-foreground">—</span>
                        )}
                        {(order as any).date_range_end && format(new Date((order as any).date_range_end), "PP")}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Assignment - Only show if integration is enabled */}
          {integrationSettings?.projects_service_orders_integration && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">Project</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
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
    </div>
  );

  // Tabs configuration
  const tabs: TabConfig[] = [
    {
      value: "details",
      label: "Details",
      icon: <FileText className="h-4 w-4" />,
      content: (
            <div className="space-y-2.5">
              <div>
                <h3 className="font-semibold text-sm mb-1.5">Order Information</h3>
                <div className="space-y-2.5">
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

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Key Number</div>
                    <div className="text-sm font-medium">{(order as any).key_number || "N/A"}</div>
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
                    <div 
                      className="text-sm prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: order.description || "No description" }}
                    />
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
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-1.5">Contact Details</h3>
                <div className="space-y-2.5">
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
                  {(order as any).contacts && (
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <User className="h-3 w-3" />
                        Contact
                      </div>
                      <div className="text-sm font-medium">
                        {(order as any).contacts.first_name} {(order as any).contacts.last_name}
                      </div>
                      {(order as any).contacts.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Mail className="h-3 w-3" />
                          {(order as any).contacts.email}
                        </div>
                      )}
                      {(order as any).contacts.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          {(order as any).contacts.phone}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
      value: "profit-loss",
      label: "Profit & Loss",
      icon: <DollarSign className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceOrderProfitLossCard
              totalRevenue={totalRevenue}
              actualCost={actualCost}
              costOfMaterials={totalCost}
              costOfLabor={0}
              apInvoiceCosts={apInvoiceCosts}
              otherCosts={0}
              profitMargin={profitMargin}
              pendingPOCosts={pendingPOCosts}
            />
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
      content: (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Invoices</h3>
            <Button onClick={handleCreateInvoice}>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </div>

          {/* AR Invoices Section */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Customer Invoices (AR)</h4>
            {!arInvoices || arInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No customer invoices created yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {arInvoices.map((invoice) => (
                  <Card
                    key={invoice.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {invoice.customers?.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(invoice.invoice_date), "PPP")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            ${Number(invoice.total_amount).toFixed(2)}
                          </p>
                          <Badge variant="secondary" className="mt-1">
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* AP Invoices Section */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Supplier Bills (AP)</h4>
            {!apInvoices || apInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No supplier invoices linked yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {apInvoices.map((invoice) => (
                  <Card
                    key={invoice.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/ap-invoices/${invoice.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {(invoice as any).suppliers?.name || "No supplier"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(invoice.invoice_date), "PPP")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            ${Number(invoice.total_amount).toFixed(2)}
                          </p>
                          <Badge variant="secondary" className="mt-1">
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
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
        secondaryActions={secondaryActions}
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

      {/* Cancel Order Confirmation */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Service Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this service order? This will mark the order as cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                updateOrderStatusMutation.mutate("cancelled");
                setCancelConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeleteConfirmText("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Order</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The original quote (if any) will be unlocked for editing.
              <br /><br />
              Please type <span className="font-bold text-foreground">delete</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Type 'delete' to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteConfirmText.toLowerCase() === "delete") {
                  deleteServiceOrderMutation.mutate();
                  setDeleteDialogOpen(false);
                  setDeleteConfirmText("");
                }
              }}
              disabled={deleteConfirmText.toLowerCase() !== "delete"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
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

      {/* Purchase Order Dialog */}
      <PurchaseOrderDialog
        open={purchaseOrderDialogOpen}
        onOpenChange={setPurchaseOrderDialogOpen}
        serviceOrderId={id}
        sourceLineItems={lineItems.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          cost_price: item.cost_price || 0,
          line_total: item.line_total || 0,
        }))}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["service-order-purchase-orders", id] });
          queryClient.invalidateQueries({ queryKey: ["service_order", id] });
        }}
      />

      {/* Contact Selector Dialog */}
      <ContactSelectorDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        customerId={order?.customer_id || ''}
        onContactSelected={async (contactId) => {
          // Update service order with new contact
          const { error } = await supabase
            .from('service_orders')
            .update({ customer_contact_id: contactId })
            .eq('id', id);
          
          if (!error) {
            queryClient.invalidateQueries({ queryKey: ["service_order", id] });
            toast({ title: "Contact linked successfully" });
          } else {
            toast({ title: "Error linking contact", description: error.message, variant: "destructive" });
          }
        }}
      />
    </>
  );
}
