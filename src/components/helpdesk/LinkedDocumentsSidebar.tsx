import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Calendar, FileText, Receipt, FolderKanban, CheckSquare, User, MapPin, X, ExternalLink, ClipboardList, DollarSign, Users, Package } from "lucide-react";
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

interface LinkedDocumentsSidebarProps {
  ticketId: string;
  ticket: any;
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

export function LinkedDocumentsSidebar({ ticketId, ticket }: LinkedDocumentsSidebarProps) {
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
      return data as any[];
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
      
      // If linking a contact, automatically link their customer
      if (field === "contact_id" && value) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("customer_id")
          .eq("id", value)
          .single();
        
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
    onError: (error) => {
      toast({
        title: "Failed to update link",
        description: error.message,
        variant: "destructive",
      });
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
        <div className="px-3 py-3 border-b">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="documents" className="text-xs">Linked Documents</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Quick Actions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="flex-1 mt-0 p-0 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-12rem)] p-3">
        <div className="space-y-3">
          {/* Customer & Contact Section */}
          <div className="space-y-2">
            <div className={cn(
              "border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors",
              ticket?.customer && "border-primary/20"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Customer</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowCustomerLink(!showCustomerLink)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {showCustomerLink ? "Cancel" : "Link"}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{ticket.customer.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => updateTicketLinkMutation.mutate({ field: "customer_id", value: null })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No customer linked</p>
              )}
            </div>

            <div className={cn(
              "border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors",
              ticket?.contact && "border-primary/20"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Contact</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowContactLink(!showContactLink)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {showContactLink ? "Cancel" : "Link"}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {ticket.contact.first_name} {ticket.contact.last_name}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => updateTicketLinkMutation.mutate({ field: "contact_id", value: null })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No contact linked</p>
              )}
            </div>

            <div className={cn(
              "border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors",
              ticket?.supplier && "border-primary/20"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Supplier</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowSupplierLink(!showSupplierLink)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {showSupplierLink ? "Cancel" : "Link"}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{ticket.supplier.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => updateTicketLinkMutation.mutate({ field: "supplier_id", value: null })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No supplier linked</p>
              )}
            </div>

            <div className={cn(
              "border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors",
              ticket?.lead && "border-primary/20"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Lead</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowLeadLink(!showLeadLink)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {showLeadLink ? "Cancel" : "Link"}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {ticket.lead.company_name} {ticket.lead.name && `- ${ticket.lead.name}`}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => updateTicketLinkMutation.mutate({ field: "lead_id", value: null })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No lead linked</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Document Type Cards */}
          {DOCUMENT_TYPES.map((docType) => {
            const docs = groupedDocs[docType.type] || [];
            const hasLinkedDocs = docs.length > 0;

            return (
              <div
                key={docType.type}
                className={cn(
                  "border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors",
                  hasLinkedDocs && "border-primary/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-primary">{docType.icon}</div>
                    <span className="text-sm font-medium">{docType.label}</span>
                    {hasLinkedDocs && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        {docs.length}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setShowDocLinks({ ...showDocLinks, [docType.type]: !showDocLinks[docType.type] })}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {showDocLinks[docType.type] ? "Cancel" : "Link"}
                  </Button>
                </div>

                {showDocLinks[docType.type] && (
                  <div className="mt-2">
                    <DocumentLinkSearch
                      docType={docType.type}
                      ticketId={ticketId}
                      onLinked={() => {
                        setShowDocLinks({ ...showDocLinks, [docType.type]: false });
                        queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
                      }}
                      onCustomerContactLinked={async (customerId, contactId) => {
                        // Only update if we don't already have these links set
                        if (customerId && !ticket?.customer_id) {
                          updateTicketLinkMutation.mutate({ 
                            field: "customer_id", 
                            value: customerId 
                          });
                        }
                        
                        // Validate contact exists before trying to link
                        if (contactId && !ticket?.contact_id) {
                          try {
                            const { data: contactExists } = await supabase
                              .from("contacts")
                              .select("id")
                              .eq("id", contactId)
                              .maybeSingle();
                            
                            if (contactExists) {
                              setTimeout(() => {
                                updateTicketLinkMutation.mutate({ 
                                  field: "contact_id", 
                                  value: contactId 
                                });
                              }, 200);
                            }
                          } catch (error) {
                            console.error("Error validating contact:", error);
                          }
                        }
                      }}
                    />
                  </div>
                )}

                {hasLinkedDocs ? (
                  <div className="space-y-1.5 mt-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="group relative p-2 rounded border border-border/50 hover:border-border hover:bg-accent/30 transition-all"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => handleDocumentClick(docType.type, doc.document_id)}
                        >
                          <div className="text-sm font-medium truncate">
                            {doc.document_number || "Untitled"}
                          </div>
                          {doc.description && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {doc.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInNewTab(docType.type, doc.document_id);
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-auto text-destructive"
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
                ) : (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    No {docType.label.toLowerCase()} linked
                  </p>
                )}
              </div>
            );
          })}
        </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 mt-0 p-0">
          <QuickActionsTab ticket={ticket} />
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
