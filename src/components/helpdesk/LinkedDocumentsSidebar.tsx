import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Calendar, FileText, Receipt, FolderKanban, CheckSquare, User, MapPin, X, ExternalLink, ClipboardList, DollarSign, Users, Package, Link2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LinkedDocumentDetailsDialog } from "./LinkedDocumentDetailsDialog";
import { QuickActionsTab } from "./QuickActionsTab";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SelectWithSearch } from "@/components/ui/select-with-search";
import { DocumentLinkSearch } from "./DocumentLinkSearch";
import { ThreadSummaryCard } from "./ThreadSummaryCard";
import { RequestCompletionReview } from "./RequestCompletionReview";

interface LinkedDocumentsSidebarProps {
  ticketId: string;
  ticket: any;
  onClose?: () => void;
}

interface DocumentType {
  type: string;
  label: string;
  icon: JSX.Element;
  route: (id: string) => string;
}

const DOCUMENT_TYPES: DocumentType[] = [
  { type: "appointment", label: "Appointments", icon: <Calendar className="h-4 w-4" />, route: (id) => `/appointments/${id}` },
  { type: "service_order", label: "Service Orders", icon: <ClipboardList className="h-4 w-4" />, route: (id) => `/service-orders/${id}` },
  { type: "quote", label: "Quotes", icon: <FileText className="h-4 w-4" />, route: (id) => `/quotes/${id}` },
  { type: "invoice", label: "Invoices", icon: <DollarSign className="h-4 w-4" />, route: (id) => `/invoices/${id}` },
  { type: "project", label: "Projects", icon: <FileText className="h-4 w-4" />, route: (id) => `/projects/${id}` },
  { type: "task", label: "Tasks", icon: <CheckSquare className="h-4 w-4" />, route: (id) => `/tasks` },
];

export function LinkedDocumentsSidebar({ ticketId, ticket, onClose }: LinkedDocumentsSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; id: string } | null>(null);
  const [showCustomerLink, setShowCustomerLink] = useState(false);
  const [showContactLink, setShowContactLink] = useState(false);
  const [showSupplierLink, setShowSupplierLink] = useState(false);
  const [showLeadLink, setShowLeadLink] = useState(false);
  const [showLocationLink, setShowLocationLink] = useState(false);
  const [showDocLinks, setShowDocLinks] = useState<Record<string, boolean>>({});

  const { data: linkedDocs } = useQuery({
    queryKey: ["helpdesk-linked-docs", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .select("*")
        .eq("ticket_id", ticketId);

      if (error) throw error;
      
      // Fetch related document details for each linked doc
      const docsWithDetails = await Promise.all(
        (data || []).map(async (doc: any) => {
          let details = null;
          
          try {
            switch (doc.document_type) {
              case 'service_order':
                const { data: so } = await supabase
                  .from("service_orders")
                  .select("work_order_number, status, preferred_date, total_amount, description, customer:customers(name)")
                  .eq("id", doc.document_id)
                  .single();
                details = so;
                break;
              case 'appointment':
                const { data: apt } = await supabase
                  .from("appointments")
                  .select("title, status, start_time, end_time, location")
                  .eq("id", doc.document_id)
                  .single();
                details = apt;
                break;
              case 'quote':
                const { data: quote } = await supabase
                  .from("quotes")
                  .select("quote_number, status, quote_date, total, customer:customers(name)")
                  .eq("id", doc.document_id)
                  .single();
                details = quote;
                break;
              case 'invoice':
                const { data: inv } = await supabase
                  .from("invoices")
                  .select("invoice_number, status, invoice_date, total_amount, customer:customers(name)")
                  .eq("id", doc.document_id)
                  .single();
                details = inv;
                break;
              case 'project':
                const { data: proj } = await supabase
                  .from("projects")
                  .select("project_number, name, status, start_date, budget, customer:customers(name)")
                  .eq("id", doc.document_id)
                  .single();
                details = proj;
                break;
              case 'task':
                const { data: task } = await supabase
                  .from("tasks")
                  .select("title, status, priority, due_date")
                  .eq("id", doc.document_id)
                  .single();
                details = task;
                break;
            }
          } catch (err) {
            console.error(`Error fetching ${doc.document_type} details:`, err);
          }
          
          return { ...doc, details };
        })
      );
      
      return docsWithDetails;
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .delete()
        .eq("id", linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
      toast({ title: "Document unlinked successfully" });
    },
  });

  const autoLinkFromMarkupsMutation = useMutation({
    mutationFn: async () => {
      // Get floor plan from ticket markups
      const { data: markup } = await supabase
        .from("ticket_markups")
        .select("floor_plan_id")
        .eq("ticket_id", ticketId)
        .limit(1)
        .maybeSingle();

      if (!markup?.floor_plan_id) {
        throw new Error("No floor plan found for this ticket");
      }

      // Get location from floor plan
      const { data: floorPlan } = await supabase
        .from("floor_plans")
        .select("customer_location_id")
        .eq("id", markup.floor_plan_id)
        .single();

      if (!floorPlan?.customer_location_id) {
        throw new Error("Floor plan has no location");
      }

      // Get customer from location
      const { data: location } = await supabase
        .from("customer_locations")
        .select("customer_id")
        .eq("id", floorPlan.customer_location_id)
        .single();

      // Update ticket with both location and customer
      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({ 
          location_id: floorPlan.customer_location_id,
          customer_id: location?.customer_id || null
        })
        .eq("id", ticketId);

      if (error) throw error;

      return floorPlan.customer_location_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-location"] });
      toast({ title: "Location and customer auto-linked from floor plan" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to auto-link location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTicketLinkMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string | null }) => {
      const updates: any = { [field]: value };
      
      // If linking a contact, automatically link their customer
      if (field === "contact_id" && value) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("customer_id")
          .eq("id", value)
          .maybeSingle();
        
        if (contact?.customer_id) {
          updates.customer_id = contact.customer_id;
        }
      }

      // If linking a location, automatically link its customer
      if (field === "location_id" && value) {
        const { data: location } = await supabase
          .from("customer_locations")
          .select("customer_id")
          .eq("id", value)
          .maybeSingle();
        
        if (location?.customer_id) {
          updates.customer_id = location.customer_id;
        }
      }

      const { error } = await supabase
        .from("helpdesk_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (error) throw error;
      
      return { field, value };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
      
      // Invalidate location query if we just updated location_id
      if (data.field === "location_id") {
        queryClient.invalidateQueries({ queryKey: ["ticket-location"] });
      }
      
      toast({ title: "Link updated successfully" });
      setShowCustomerLink(false);
      setShowContactLink(false);
      setShowSupplierLink(false);
      setShowLeadLink(false);
      setShowLocationLink(false);
    },
    onError: (error: any) => {
      console.error("Update link error:", error);
      
      // Check if it's a foreign key constraint error for contact
      if (error.message?.includes("contact_id") || error.message?.includes("foreign key constraint")) {
        toast({
          title: "Cannot link contact",
          description: "The contact no longer exists. Please select a different contact.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to update link",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: showCustomerLink,
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, customer_id")
        .order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: showContactLink,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: showSupplierLink,
  });

  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, name")
        .order("company_name");
      if (error) throw error;
      return data;
    },
    enabled: showLeadLink,
  });

  const { data: locations } = useQuery({
    queryKey: ["customer-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name, address, customer:customers(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: showLocationLink,
  });

  const groupedDocs = linkedDocs?.reduce((acc, doc) => {
    if (!acc[doc.document_type]) {
      acc[doc.document_type] = [];
    }
    acc[doc.document_type].push(doc);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // Fetch location data if ticket has location_id
  const { data: ticketLocation } = useQuery({
    queryKey: ["ticket-location", ticket?.location_id],
    queryFn: async () => {
      if (!ticket?.location_id) return null;
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name, address, customer:customers(name)")
        .eq("id", ticket.location_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!ticket?.location_id,
  });

  // Calculate total linked items count
  const totalLinkedCount = useMemo(() => {
    let count = 0;
    if (ticket?.customer) count++;
    if (ticket?.contact) count++;
    if (ticket?.supplier) count++;
    if (ticket?.lead) count++;
    if (ticketLocation) count++;
    if (linkedDocs) count += linkedDocs.length;
    return count;
  }, [ticket, ticketLocation, linkedDocs]);

  const handleDocumentClick = (docType: string, docId: string) => {
    setSelectedDocument({ type: docType, id: docId });
    setDetailsDialogOpen(true);
  };

  const handleOpenInNewTab = (docType: string, docId: string) => {
    const routeMap: Record<string, (id: string) => string> = {
      service_order: (id) => `/service-orders/${id}`,
      quote: (id) => `/quotes/${id}`,
      invoice: (id) => `/invoices/${id}`,
      project: (id) => `/projects/${id}`,
      task: (id) => `/tasks`,
      appointment: (id) => `/appointments/${id}`,
    };
    
    const routeFn = routeMap[docType];
    if (routeFn) {
      window.open(routeFn(docId), "_blank");
    }
  };

  return (
    <div className="flex flex-col h-full border-l bg-gradient-to-b from-background to-muted/10">
      <Tabs defaultValue="documents" className="flex flex-col flex-1 overflow-hidden">
        {/* Enhanced Header */}
        <div className="px-4 py-4 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Links & Actions</h3>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <TabsList className="w-full grid grid-cols-2 bg-muted/50 p-1">
              <TabsTrigger value="documents" className="text-xs relative data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                Links
                {totalLinkedCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground shadow-sm">
                    {totalLinkedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                Actions
              </TabsTrigger>
            </TabsList>
            
            {totalLinkedCount > 0 && (
              <div className="text-xs text-muted-foreground px-1">
                {[
                  ticket?.customer && 'Customer',
                  ticket?.contact && 'Contact', 
                  ticket?.supplier && 'Supplier',
                  ticket?.lead && 'Lead',
                  ticketLocation && 'Location',
                  linkedDocs && linkedDocs.length > 0 && `${linkedDocs.length} doc${linkedDocs.length === 1 ? '' : 's'}`
                ].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>

        <TabsContent value="documents" className="flex-1 mt-0 p-0 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-4 pb-8 space-y-4">
              {/* AI Thread Summary - Only show for non-Requests pipelines */}
              {ticket?.pipeline?.name !== "Requests" && (
                <ThreadSummaryCard ticketId={ticketId} />
              )}
              
              {/* Request Completion Review (only for Requests pipeline) */}
              {ticket?.pipeline?.name === "Requests" && (
                <RequestCompletionReview ticketId={ticketId} ticket={ticket} />
              )}
              
              {/* Entities Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">People & Companies</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {/* Customer Card */}
                <div className={cn(
              "group relative overflow-hidden rounded-xl border transition-all duration-200",
              ticket?.customer 
                ? "bg-gradient-to-br from-background to-primary/5 border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
                : "bg-card border-border hover:border-primary/20 hover:shadow-sm"
            )}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                      ticket?.customer ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Users className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">Customer</span>
                  </div>
                  <Button 
                    variant={showCustomerLink ? "secondary" : "ghost"}
                    size="sm" 
                    className="h-7 px-2.5 text-xs font-medium"
                    onClick={() => setShowCustomerLink(!showCustomerLink)}
                  >
                    {showCustomerLink ? "Cancel" : ticket?.customer ? "Change" : "+ Link"}
                  </Button>
                </div>
                
                {showCustomerLink ? (
                  <SelectWithSearch
                    value={ticket?.customer_id || ""}
                    onValueChange={(value) => {
                      updateTicketLinkMutation.mutate({ field: "customer_id", value: value || null });
                    }}
                    options={[
                      { value: "", label: "None" },
                      ...(customers?.map((customer) => ({
                        value: customer.id,
                        label: customer.name,
                      })) || [])
                    ]}
                    placeholder="Select customer..."
                    searchPlaceholder="Search customers..."
                  />
                ) : ticket?.customer ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-medium text-foreground">{ticket.customer.name}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => updateTicketLinkMutation.mutate({ field: "customer_id", value: null })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Contact Card */}
            <div className={cn(
              "group relative overflow-hidden rounded-xl border transition-all duration-200",
              ticket?.contact 
                ? "bg-gradient-to-br from-background to-primary/5 border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
                : "bg-card border-border hover:border-primary/20 hover:shadow-sm"
            )}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                      ticket?.contact ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">Contact</span>
                  </div>
                  <Button 
                    variant={showContactLink ? "secondary" : "ghost"}
                    size="sm" 
                    className="h-7 px-2.5 text-xs font-medium"
                    onClick={() => setShowContactLink(!showContactLink)}
                  >
                    {showContactLink ? "Cancel" : ticket?.contact ? "Change" : "+ Link"}
                  </Button>
                </div>
                
                {showContactLink ? (
                  <SelectWithSearch
                    value={ticket?.contact_id || ""}
                    onValueChange={(value) => {
                      updateTicketLinkMutation.mutate({ field: "contact_id", value: value || null });
                    }}
                    options={[
                      { value: "", label: "None" },
                      ...(contacts?.map((contact) => ({
                        value: contact.id,
                        label: `${contact.first_name} ${contact.last_name}${contact.email ? ` (${contact.email})` : ''}`,
                      })) || [])
                    ]}
                    placeholder="Select contact..."
                    searchPlaceholder="Search contacts..."
                  />
                ) : ticket?.contact ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-medium text-foreground">
                      {ticket.contact.first_name} {ticket.contact.last_name}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => updateTicketLinkMutation.mutate({ field: "contact_id", value: null })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Supplier Card */}
            <div className={cn(
              "group relative overflow-hidden rounded-xl border transition-all duration-200",
              ticket?.supplier 
                ? "bg-gradient-to-br from-background to-primary/5 border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
                : "bg-card border-border hover:border-primary/20 hover:shadow-sm"
            )}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                      ticket?.supplier ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Package className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">Supplier</span>
                  </div>
                  <Button 
                    variant={showSupplierLink ? "secondary" : "ghost"}
                    size="sm" 
                    className="h-7 px-2.5 text-xs font-medium"
                    onClick={() => setShowSupplierLink(!showSupplierLink)}
                  >
                    {showSupplierLink ? "Cancel" : ticket?.supplier ? "Change" : "+ Link"}
                  </Button>
                </div>
                
                {showSupplierLink ? (
                  <SelectWithSearch
                    value={ticket?.supplier_id || ""}
                    onValueChange={(value) => {
                      updateTicketLinkMutation.mutate({ field: "supplier_id", value: value || null });
                    }}
                    options={[
                      { value: "", label: "None" },
                      ...(suppliers?.map((supplier) => ({
                        value: supplier.id,
                        label: supplier.name,
                      })) || [])
                    ]}
                    placeholder="Select supplier..."
                    searchPlaceholder="Search suppliers..."
                  />
                ) : ticket?.supplier ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-medium text-foreground">{ticket.supplier.name}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => updateTicketLinkMutation.mutate({ field: "supplier_id", value: null })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Lead Card */}
            <div className={cn(
              "group relative overflow-hidden rounded-xl border transition-all duration-200",
              ticket?.lead 
                ? "bg-gradient-to-br from-background to-primary/5 border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
                : "bg-card border-border hover:border-primary/20 hover:shadow-sm"
            )}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                      ticket?.lead ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">Lead</span>
                  </div>
                  <Button 
                    variant={showLeadLink ? "secondary" : "ghost"}
                    size="sm" 
                    className="h-7 px-2.5 text-xs font-medium"
                    onClick={() => setShowLeadLink(!showLeadLink)}
                  >
                    {showLeadLink ? "Cancel" : ticket?.lead ? "Change" : "+ Link"}
                  </Button>
                </div>
                
                {showLeadLink ? (
                  <SelectWithSearch
                    value={ticket?.lead_id || ""}
                    onValueChange={(value) => {
                      updateTicketLinkMutation.mutate({ field: "lead_id", value: value || null });
                    }}
                    options={[
                      { value: "", label: "None" },
                      ...(leads?.map((lead) => ({
                        value: lead.id,
                        label: `${lead.company_name}${lead.name ? ` - ${lead.name}` : ''}`,
                      })) || [])
                    ]}
                    placeholder="Select lead..."
                    searchPlaceholder="Search leads..."
                  />
                ) : ticket?.lead ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-medium text-foreground">
                      {ticket.lead.company_name} {ticket.lead.name && `· ${ticket.lead.name}`}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => updateTicketLinkMutation.mutate({ field: "lead_id", value: null })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Location Card */}
            <div className={cn(
              "group relative overflow-hidden rounded-xl border transition-all duration-200",
              ticketLocation 
                ? "bg-gradient-to-br from-background to-primary/5 border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
                : "bg-card border-border hover:border-primary/20 hover:shadow-sm"
            )}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                      ticketLocation ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">Location</span>
                  </div>
                  {ticket?.pipeline?.name === "Requests" && !ticketLocation && (
                    <Button 
                      variant="ghost"
                      size="sm" 
                      className="h-7 px-2.5 text-xs font-medium"
                      onClick={() => autoLinkFromMarkupsMutation.mutate()}
                      disabled={autoLinkFromMarkupsMutation.isPending}
                    >
                      Auto-Link
                    </Button>
                  )}
                  {!ticket?.pipeline?.name?.includes("Requests") && (
                    <Button 
                      variant={showLocationLink ? "secondary" : "ghost"}
                      size="sm" 
                      className="h-7 px-2.5 text-xs font-medium"
                      onClick={() => setShowLocationLink(!showLocationLink)}
                    >
                      {showLocationLink ? "Cancel" : ticketLocation ? "Change" : "+ Link"}
                    </Button>
                  )}
                </div>
                
                {showLocationLink ? (
                  <SelectWithSearch
                    value={ticket?.location_id || ""}
                    onValueChange={(value) => {
                      updateTicketLinkMutation.mutate({ field: "location_id", value: value || null });
                    }}
                    options={[
                      { value: "", label: "None" },
                      ...(locations?.map((location) => ({
                        value: location.id,
                        label: `${location.name}${location.customer?.name ? ` - ${location.customer.name}` : ''}`,
                      })) || [])
                    ]}
                    placeholder="Select location..."
                    searchPlaceholder="Search locations..."
                  />
                ) : ticketLocation ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ticketLocation.name}</p>
                      {ticketLocation.address && (
                        <p className="text-xs text-muted-foreground mt-0.5">{ticketLocation.address}</p>
                      )}
                      {ticketLocation.customer?.name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{ticketLocation.customer.name}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => updateTicketLinkMutation.mutate({ field: "location_id", value: null })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {ticket?.pipeline?.name === "Requests" 
                      ? "Click Auto-Link to link location from floor plan markups" 
                      : "Link a location to this ticket"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documents & Records</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Document Type Cards */}
              {DOCUMENT_TYPES.map((docType) => {
              const docs = groupedDocs[docType.type] || [];
              const hasLinkedDocs = docs.length > 0;
              const isAppointment = docType.type === 'appointment';

              return (
                <div
                  key={docType.type}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border transition-all duration-200",
                    hasLinkedDocs 
                      ? "bg-gradient-to-br from-background to-primary/5 border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
                      : "bg-card border-border hover:border-primary/20 hover:shadow-sm",
                    // Highlight appointments for better visibility
                    isAppointment && !hasLinkedDocs && "ring-2 ring-primary/20"
                  )}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                          hasLinkedDocs ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {docType.icon}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{docType.label}</span>
                          {hasLinkedDocs && (
                            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-semibold rounded-full bg-primary/20 text-primary">
                              {docs.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={showDocLinks[docType.type] ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-7 px-2.5 text-xs font-medium",
                          isAppointment && !hasLinkedDocs && "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                        onClick={() => setShowDocLinks({ ...showDocLinks, [docType.type]: !showDocLinks[docType.type] })}
                      >
                        {showDocLinks[docType.type] ? "Cancel" : hasLinkedDocs ? "Add More" : "+ Link"}
                      </Button>
                    </div>
                    
                    {/* Help text for appointment linking */}
                    {isAppointment && !hasLinkedDocs && !showDocLinks[docType.type] && (
                      <div className="text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg">
                        💡 Link this request to an appointment to schedule the work
                      </div>
                    )}

                  {showDocLinks[docType.type] && (
                    <div className="mt-2">
                      <DocumentLinkSearch
                        docType={docType.type}
                        ticketId={ticketId}
                        onLinked={() => {
                          setShowDocLinks({ ...showDocLinks, [docType.type]: false });
                          queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
                        }}
                        onCustomerContactLinked={(customerId, contactId) => {
                          // Only update customer if we don't already have one and it's provided
                          if (customerId && !ticket?.customer_id) {
                            updateTicketLinkMutation.mutate({ 
                              field: "customer_id", 
                              value: customerId 
                            });
                          }
                          
                          // Contact linking now handled automatically via onCustomerContactLinked callback
                        }}
                      />
                    </div>
                  )}

                    {hasLinkedDocs ? (
                      <div className="space-y-2">
                        {docs.map((doc, index) => {
                      // Extract details from the fetched data
                      const docData = doc.details;
                      
                      const getDocumentDetails = () => {
                        switch (docType.type) {
                          case 'service_order':
                            return {
                              title: docData?.work_order_number || doc.document_number || 'Untitled',
                              status: docData?.status,
                              date: docData?.preferred_date,
                              amount: docData?.total_amount,
                              customer: docData?.customer?.name,
                              description: docData?.description,
                              label: 'Preferred Date'
                            };
                          case 'appointment':
                            return {
                              title: docData?.title || doc.document_number || 'Untitled',
                              status: docData?.status,
                              date: docData?.start_time,
                              time: docData?.end_time ? `${new Date(docData.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(docData.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : null,
                              location: docData?.location,
                              label: 'Scheduled'
                            };
                          case 'quote':
                            return {
                              title: docData?.quote_number || doc.document_number || 'Untitled',
                              status: docData?.status,
                              date: docData?.quote_date,
                              amount: docData?.total,
                              customer: docData?.customer?.name,
                              label: 'Quote Date'
                            };
                          case 'invoice':
                            return {
                              title: docData?.invoice_number || doc.document_number || 'Untitled',
                              status: docData?.status,
                              date: docData?.invoice_date,
                              amount: docData?.total_amount,
                              customer: docData?.customer?.name,
                              label: 'Invoice Date'
                            };
                          case 'project':
                            return {
                              title: docData?.project_number || docData?.name || doc.document_number || 'Untitled',
                              status: docData?.status,
                              date: docData?.start_date,
                              amount: docData?.budget,
                              customer: docData?.customer?.name,
                              label: 'Start Date'
                            };
                          case 'task':
                            return {
                              title: docData?.title || doc.document_number || 'Untitled',
                              status: docData?.status,
                              priority: docData?.priority,
                              date: docData?.due_date,
                              label: 'Due Date'
                            };
                          default:
                            return { title: doc.document_number || 'Untitled' };
                        }
                      };
                      
                        const details = getDocumentDetails();
                        
                        return (
                          <div
                            key={doc.id}
                            style={{ animationDelay: `${index * 40}ms` }}
                            className="group relative p-3 rounded-lg border border-border/50 bg-gradient-to-br from-background to-muted/10 hover:from-background hover:to-muted/20 hover:border-primary/40 hover:shadow-lg transition-all duration-200 cursor-pointer animate-fade-in-up hover-lift"
                            onClick={() => handleDocumentClick(docType.type, doc.document_id)}
                          >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="font-bold text-sm text-foreground flex-1 group-hover:text-primary transition-colors">
                              {details.title}
                            </div>
                            {details.status && (
                              <span className={cn(
                                "text-[10px] px-2 py-1 rounded-full shrink-0 font-bold uppercase tracking-wider transition-all",
                                details.status === 'completed' && "bg-success/20 text-success border border-success/30",
                                details.status === 'pending' && "bg-warning/15 text-warning border border-warning/30",
                                details.status === 'in_progress' && "bg-info/15 text-info border border-info/30",
                                details.status === 'cancelled' && "bg-destructive/15 text-destructive border border-destructive/30",
                                details.status === 'draft' && "bg-muted text-muted-foreground border border-border",
                                details.status === 'scheduled' && "bg-primary/15 text-primary border border-primary/30",
                                details.status === 'confirmed' && "bg-success/15 text-success border border-success/30",
                                details.status === 'sent' && "bg-info/15 text-info border border-info/30",
                                details.status === 'accepted' && "bg-success/15 text-success border border-success/30"
                              )}>
                                {details.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {details.customer && (
                              <div className="text-xs text-muted-foreground font-medium">
                                {details.customer}
                              </div>
                            )}
                            
                            {details.description && docType.type === 'service_order' && (
                              <div className="text-xs text-muted-foreground/80 line-clamp-2 italic">
                                {details.description}
                              </div>
                            )}
                            
                            {details.location && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-primary/60" />
                                <span className="font-medium">{details.location}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between text-xs pt-1">
                              {details.date && (
                                <div className="text-muted-foreground">
                                  <span className="font-semibold">{details.label}:</span> {new Date(details.date).toLocaleDateString()}
                                  {details.time && <div className="mt-0.5 text-[11px]">{details.time}</div>}
                                </div>
                              )}
                              {details.amount && (
                                <div className="font-bold text-sm text-foreground">
                                  ${details.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )}
                            </div>
                            
                            {details.priority && (
                              <span className={cn(
                                "inline-flex text-xs px-2 py-1 rounded-full font-semibold border",
                                details.priority === 'high' && "bg-destructive/15 text-destructive border-destructive/30",
                                details.priority === 'medium' && "bg-warning/15 text-warning border-warning/30",
                                details.priority === 'low' && "bg-success/15 text-success border-success/30"
                              )}>
                                {details.priority} priority
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 absolute top-10 right-2 opacity-0 group-hover:opacity-100 transition-all">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInNewTab(docType.type, doc.document_id);
                              }}
                              title="Open in new tab"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                unlinkMutation.mutate(doc.id);
                              }}
                              title="Unlink document"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 mt-0 p-0 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:overflow-hidden">
          <QuickActionsTab
            ticket={ticket} 
            onDocumentLinked={() => {
              queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
            }}
          />
        </TabsContent>
      </Tabs>

      {selectedDocument && (
        <LinkedDocumentDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          documentType={selectedDocument.type}
          documentId={selectedDocument.id}
        />
      )}
    </div>
  );
}
