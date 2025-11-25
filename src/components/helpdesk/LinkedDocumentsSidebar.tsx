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
  { type: "service_order", label: "Service Orders", icon: <ClipboardList className="h-4 w-4" />, route: (id) => `/service-orders/${id}` },
  { type: "appointment", label: "Appointments", icon: <Calendar className="h-4 w-4" />, route: (id) => `/appointments/${id}` },
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
  const [showDocLinks, setShowDocLinks] = useState<Record<string, boolean>>({});

  const { data: linkedDocs } = useQuery({
    queryKey: ["helpdesk-linked-docs", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .select("*")
        .eq("ticket_id", ticketId);

      if (error) throw error;
      
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

  const updateTicketLinkMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string | null }) => {
      const updates: any = { [field]: value };
      
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

      const { error } = await supabase
        .from("helpdesk_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
      toast({ title: "Link updated successfully" });
      setShowCustomerLink(false);
      setShowContactLink(false);
      setShowSupplierLink(false);
      setShowLeadLink(false);
    },
    onError: (error: any) => {
      console.error("Update link error:", error);
      
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

  const groupedDocs = linkedDocs?.reduce((acc, doc) => {
    if (!acc[doc.document_type]) {
      acc[doc.document_type] = [];
    }
    acc[doc.document_type].push(doc);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const totalLinkedCount = useMemo(() => {
    let count = 0;
    if (ticket?.customer) count++;
    if (ticket?.contact) count++;
    if (ticket?.supplier) count++;
    if (ticket?.lead) count++;
    if (linkedDocs) count += linkedDocs.length;
    return count;
  }, [ticket, linkedDocs]);

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
    <div className="flex flex-col h-full border-l bg-background">
      <Tabs defaultValue="documents" className="flex flex-col h-full">
        {/* Minimal Header */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <TabsList className="h-8 p-0.5 bg-muted/50">
              <TabsTrigger value="documents" className="text-xs h-7 px-3">
                Details
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs h-7 px-3">
                Actions
              </TabsTrigger>
            </TabsList>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="documents" className="flex-1 mt-0 p-0 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-15rem)]">
            <div className="p-4 space-y-3">
              {/* AI Thread Summary */}
              <ThreadSummaryCard ticketId={ticketId} />
              
              {/* Entities Section - HubSpot clean style */}
              <div className="space-y-1.5">
                {/* Customer */}
                <div className="border-b py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Customer</span>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowCustomerLink(!showCustomerLink)}
                    >
                      {ticket?.customer ? "Change" : "+ Add"}
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
                    <div className="flex items-center justify-between pl-6">
                      <p className="text-sm text-foreground">{ticket.customer.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => updateTicketLinkMutation.mutate({ field: "customer_id", value: null })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground pl-6">No customer linked</p>
                  )}
                </div>

                {/* Contact */}
                <div className="border-b py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Contact</span>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowContactLink(!showContactLink)}
                    >
                      {ticket?.contact ? "Change" : "+ Add"}
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
                          label: `${contact.first_name} ${contact.last_name}`.trim() + (contact.email ? ` (${contact.email})` : ''),
                        })) || [])
                      ]}
                      placeholder="Select contact..."
                      searchPlaceholder="Search contacts..."
                    />
                  ) : ticket?.contact ? (
                    <div className="flex items-center justify-between pl-6">
                      <div>
                        <p className="text-sm text-foreground">
                          {ticket.contact.first_name} {ticket.contact.last_name}
                        </p>
                        {ticket.contact.email && (
                          <p className="text-xs text-muted-foreground">{ticket.contact.email}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => updateTicketLinkMutation.mutate({ field: "contact_id", value: null })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground pl-6">No contact linked</p>
                  )}
                </div>

                {/* Supplier */}
                <div className="border-b py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Supplier</span>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowSupplierLink(!showSupplierLink)}
                    >
                      {ticket?.supplier ? "Change" : "+ Add"}
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
                    <div className="flex items-center justify-between pl-6">
                      <p className="text-sm text-foreground">{ticket.supplier.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => updateTicketLinkMutation.mutate({ field: "supplier_id", value: null })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground pl-6">No supplier linked</p>
                  )}
                </div>

                {/* Lead */}
                <div className="border-b py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Lead</span>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowLeadLink(!showLeadLink)}
                    >
                      {ticket?.lead ? "Change" : "+ Add"}
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
                    <div className="flex items-center justify-between pl-6">
                      <p className="text-sm text-foreground">
                        {ticket.lead.company_name} {ticket.lead.name && `· ${ticket.lead.name}`}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => updateTicketLinkMutation.mutate({ field: "lead_id", value: null })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground pl-6">No lead linked</p>
                  )}
                </div>
              </div>

              {/* Documents Section - Simplified HubSpot style */}
              <div className="space-y-1.5 mt-4">
                {DOCUMENT_TYPES.map((docType) => {
                  const docs = groupedDocs[docType.type] || [];
                  const hasLinkedDocs = docs.length > 0;

                  return (
                    <div key={docType.type} className="border-b py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {docType.icon}
                          <span className="text-sm font-medium">{docType.label}</span>
                          {hasLinkedDocs && (
                            <span className="text-xs text-muted-foreground">({docs.length})</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setShowDocLinks({ ...showDocLinks, [docType.type]: !showDocLinks[docType.type] })}
                        >
                          + Add
                        </Button>
                      </div>

                      {showDocLinks[docType.type] && (
                        <div className="mt-2 pl-6">
                          <DocumentLinkSearch
                            docType={docType.type}
                            ticketId={ticketId}
                            onLinked={() => {
                              setShowDocLinks({ ...showDocLinks, [docType.type]: false });
                              queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
                            }}
                            onCustomerContactLinked={(customerId, contactId) => {
                              if (customerId && !ticket?.customer_id) {
                                updateTicketLinkMutation.mutate({ 
                                  field: "customer_id", 
                                  value: customerId 
                                });
                              }
                            }}
                          />
                        </div>
                      )}

                      {hasLinkedDocs && (
                        <div className="space-y-1 pl-6">
                          {docs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between py-1.5 text-sm group"
                            >
                              <span 
                                className="text-foreground hover:text-primary cursor-pointer truncate"
                                onClick={() => handleDocumentClick(docType.type, doc.document_id)}
                              >
                                {doc.document_number || doc.details?.title || 'Untitled'}
                              </span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInNewTab(docType.type, doc.document_id);
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    unlinkMutation.mutate(doc.id);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!hasLinkedDocs && !showDocLinks[docType.type] && (
                        <p className="text-xs text-muted-foreground pl-6">
                          No {docType.label.toLowerCase()} linked
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 mt-0 p-0">
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
