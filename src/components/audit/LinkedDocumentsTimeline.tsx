import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Receipt, Folder, Calendar, User, ExternalLink, UserCircle } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface LinkedDocumentsTimelineProps {
  documentType: string;
  documentId: string;
}

interface LinkedDocument {
  id: string;
  type: string;
  number: string;
  title: string;
  createdAt: Date;
  createdBy: string;
  status?: string;
  route: string;
}

export function LinkedDocumentsTimeline({ documentType, documentId }: LinkedDocumentsTimelineProps) {
  const navigate = useNavigate();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["linked-documents-timeline", documentType, documentId],
    queryFn: async () => {
      const allDocuments: LinkedDocument[] = [];

      // Helper to fetch user name
      const getUserName = async (userId: string) => {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .single();
        return data ? `${data.first_name} ${data.last_name}` : "Unknown";
      };

      // Fetch linked quotes
      if (documentType === "service_order" || documentType === "project") {
        const { data: quotes } = await supabase
          .from("quotes")
          .select("id, quote_number, title, status, created_at, created_by")
          .or(
            documentType === "service_order"
              ? `converted_to_service_order_id.eq.${documentId}`
              : `converted_to_project_id.eq.${documentId}`
          );

        if (quotes) {
          for (const quote of quotes) {
            const createdBy = await getUserName(quote.created_by);
            allDocuments.push({
              id: quote.id,
              type: "Quote",
              number: quote.quote_number,
              title: quote.title,
              createdAt: new Date(quote.created_at),
              createdBy,
              status: quote.status,
              route: `/quotes/${quote.id}`,
            });
          }
        }
      }

      // Fetch linked service orders
      if (documentType === "project") {
        const { data: orders } = await supabase
          .from("service_orders")
          .select("id, order_number, title, status, created_at, created_by")
          .eq("project_id", documentId);

        if (orders) {
          for (const order of orders) {
            const createdBy = await getUserName(order.created_by);
            allDocuments.push({
              id: order.id,
              type: "Service Order",
              number: order.order_number,
              title: order.title,
              createdAt: new Date(order.created_at),
              createdBy,
              status: order.status,
              route: `/service-orders/${order.id}`,
            });
          }
        }
      }

      // Fetch linked invoices
      const { data: invoiceLinks } = await supabase
        .from("invoice_line_items")
        .select("invoice_id")
        .eq("source_type", documentType)
        .eq("source_id", documentId);

      if (invoiceLinks && invoiceLinks.length > 0) {
        const invoiceIds = [...new Set(invoiceLinks.map((l) => l.invoice_id))];
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, invoice_number, status, created_at, created_by")
          .in("id", invoiceIds);

        if (invoices) {
          for (const invoice of invoices) {
            const createdBy = await getUserName(invoice.created_by);
            allDocuments.push({
              id: invoice.id,
              type: "Invoice",
              number: invoice.invoice_number,
              title: `Invoice ${invoice.invoice_number}`,
              createdAt: new Date(invoice.created_at),
              createdBy,
              status: invoice.status,
              route: `/invoices/${invoice.id}`,
            });
          }
        }
      }

      // Fetch linked projects (for service orders)
      if (documentType === "service_order") {
        const { data: order } = await supabase
          .from("service_orders")
          .select("project_id, projects(id, name, status, created_at, created_by)")
          .eq("id", documentId)
          .single();

        if (order?.project_id && order.projects) {
          const project = order.projects as any;
          const createdBy = await getUserName(project.created_by);
          allDocuments.push({
            id: project.id,
            type: "Project",
            number: project.name,
            title: project.name,
            createdAt: new Date(project.created_at),
            createdBy,
            status: project.status,
            route: `/projects/${project.id}`,
          });
        }
      }

      // Fetch linked lead and contacts for quotes
      if (documentType === "quote") {
        const { data: quote } = await supabase
          .from("quotes")
          .select("lead_id, customer_id, converted_to_service_order_id, converted_to_project_id")
          .eq("id", documentId)
          .single();

        // Fetch linked lead
        if (quote?.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, name, company_name, status, created_at, created_by")
            .eq("id", quote.lead_id)
            .single();

          if (lead) {
            const createdBy = await getUserName(lead.created_by);
            allDocuments.push({
              id: lead.id,
              type: "Lead",
              number: lead.company_name || lead.name,
              title: lead.name,
              createdAt: new Date(lead.created_at),
              createdBy,
              status: lead.status,
              route: `/leads/${lead.id}`,
            });
          }
        }

        // Fetch linked contacts (from lead or customer)
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, status, created_at")
          .or(
            quote?.lead_id 
              ? `lead_id.eq.${quote.lead_id},customer_id.eq.${quote.customer_id}`
              : `customer_id.eq.${quote.customer_id}`
          );

        if (contacts) {
          for (const contact of contacts) {
            allDocuments.push({
              id: contact.id,
              type: "Contact",
              number: `${contact.first_name} ${contact.last_name}`,
              title: `${contact.first_name} ${contact.last_name}`,
              createdAt: new Date(contact.created_at),
              createdBy: "System",
              status: contact.status,
              route: `/contacts/${contact.id}`,
            });
          }
        }

      // Fetch linked service contracts
        const { data: contracts } = await supabase
          .from("service_contracts")
          .select("id, contract_number, title, status, created_at, created_by")
          .eq("quote_id", documentId);

        if (contracts) {
          for (const contract of contracts) {
            const createdBy = await getUserName(contract.created_by);
            allDocuments.push({
              id: contract.id,
              type: "Service Contract",
              number: contract.contract_number,
              title: contract.title,
              createdAt: new Date(contract.created_at),
              createdBy,
              status: contract.status,
              route: `/service-contracts/${contract.id}`,
            });
          }
        }

        // Fetch converted service order
        if (quote?.converted_to_service_order_id) {
          const { data: serviceOrder } = await supabase
            .from("service_orders")
            .select("id, order_number, title, status, created_at, created_by")
            .eq("id", quote.converted_to_service_order_id)
            .single();

          if (serviceOrder) {
            const createdBy = await getUserName(serviceOrder.created_by);
            allDocuments.push({
              id: serviceOrder.id,
              type: "Service Order",
              number: serviceOrder.order_number,
              title: serviceOrder.title,
              createdAt: new Date(serviceOrder.created_at),
              createdBy,
              status: serviceOrder.status,
              route: `/service-orders/${serviceOrder.id}`,
            });
          }
        }

        // Fetch converted project
        if (quote?.converted_to_project_id) {
          const { data: project } = await supabase
            .from("projects")
            .select("id, name, status, created_at, created_by")
            .eq("id", quote.converted_to_project_id)
            .single();

          if (project) {
            const createdBy = await getUserName(project.created_by);
            allDocuments.push({
              id: project.id,
              type: "Project",
              number: project.name,
              title: project.name,
              createdAt: new Date(project.created_at),
              createdBy,
              status: project.status,
              route: `/projects/${project.id}`,
            });
          }
        }
      }

      // Fetch linked documents from helpdesk_linked_documents table
      const { data: linkedDocs } = await supabase
        .from("helpdesk_linked_documents")
        .select("*")
        .eq("document_type", documentType)
        .eq("document_id", documentId);

      if (linkedDocs) {
        for (const link of linkedDocs) {
          // Fetch the actual helpdesk ticket
          const { data: ticket } = await supabase
            .from("helpdesk_tickets")
            .select("id, ticket_number, subject, status, created_at")
            .eq("id", link.ticket_id)
            .single();

          if (ticket) {
            allDocuments.push({
              id: ticket.id,
              type: "Help Desk Ticket",
              number: ticket.ticket_number,
              title: ticket.subject,
              createdAt: new Date(ticket.created_at),
              createdBy: "System",
              status: ticket.status,
              route: `/help-desk?ticketId=${ticket.id}`,
            });
          }
        }
      }

      // Also fetch documents that link TO this document (reverse lookup)
      const { data: reverseLinks } = await supabase
        .from("helpdesk_linked_documents")
        .select("*")
        .eq("ticket_id", documentId);

      if (reverseLinks) {
        for (const link of reverseLinks) {
          // Determine what type of document is linked
          let docData = null;
          let docType = "";
          let route = "";
          
          if (link.document_type === "quote") {
            const { data } = await supabase
              .from("quotes")
              .select("id, quote_number, title, status, created_at")
              .eq("id", link.document_id)
              .single();
            docData = data;
            docType = "Quote";
            route = `/quotes/${link.document_id}`;
          } else if (link.document_type === "service_order") {
            const { data } = await supabase
              .from("service_orders")
              .select("id, order_number, title, status, created_at")
              .eq("id", link.document_id)
              .single();
            docData = data;
            docType = "Service Order";
            route = `/service-orders/${link.document_id}`;
          } else if (link.document_type === "project") {
            const { data } = await supabase
              .from("projects")
              .select("id, project_number, name, status, created_at")
              .eq("id", link.document_id)
              .single();
            docData = data;
            docType = "Project";
            route = `/projects/${link.document_id}`;
          } else if (link.document_type === "purchase_order") {
            const { data } = await supabase
              .from("purchase_orders")
              .select("id, po_number, status, created_at")
              .eq("id", link.document_id)
              .single();
            docData = data;
            docType = "Purchase Order";
            route = `/purchase-orders/${link.document_id}`;
          } else if (link.document_type === "invoice") {
            const { data } = await supabase
              .from("invoices")
              .select("id, invoice_number, status, created_at")
              .eq("id", link.document_id)
              .single();
            docData = data;
            docType = "Invoice";
            route = `/invoices/${link.document_id}`;
          } else if (link.document_type === "contract") {
            const { data } = await supabase
              .from("service_contracts")
              .select("id, contract_number, title, status, created_at")
              .eq("id", link.document_id)
              .single();
            docData = data;
            docType = "Service Contract";
            route = `/service-contracts/${link.document_id}`;
          }

          if (docData) {
            allDocuments.push({
              id: docData.id,
              type: docType,
              number: link.document_number || docData.quote_number || docData.order_number || docData.project_number || docData.po_number || docData.invoice_number || docData.contract_number || "N/A",
              title: docData.title || docData.name || docData.subject || "Untitled",
              createdAt: new Date(docData.created_at),
              createdBy: "System",
              status: docData.status,
              route,
            });
          }
        }
      }

      // Sort by created date (newest first)
      return allDocuments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No linked documents found</p>
      </div>
    );
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "Quote":
        return <FileText className="h-4 w-4" />;
      case "Invoice":
        return <Receipt className="h-4 w-4" />;
      case "Service Order":
        return <Calendar className="h-4 w-4" />;
      case "Project":
        return <Folder className="h-4 w-4" />;
      case "Service Contract":
        return <FileText className="h-4 w-4" />;
      case "Lead":
        return <User className="h-4 w-4" />;
      case "Contact":
        return <UserCircle className="h-4 w-4" />;
      case "Help Desk Ticket":
        return <FileText className="h-4 w-4" />;
      case "Purchase Order":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-muted text-muted-foreground";
    switch (status.toLowerCase()) {
      case "draft":
      case "waiting":
        return "bg-muted text-muted-foreground";
      case "sent":
      case "scheduled":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "approved":
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "completed":
      case "paid":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "in_progress":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "rejected":
      case "cancelled":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <ScrollArea className="h-[600px]">
      <div className="relative space-y-6 p-4">
        {/* Timeline line */}
        <div className="absolute left-[29px] top-0 bottom-0 w-px bg-border" />

        {documents.map((doc) => (
          <div key={`${doc.type}-${doc.id}`} className="relative pl-12">
            {/* Timeline dot */}
            <div className="absolute left-[23px] top-2 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />

            <Card
              className="hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(doc.route)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="gap-1">
                        {getDocumentIcon(doc.type)}
                        <span>{doc.type}</span>
                      </Badge>
                      {doc.status && (
                        <Badge variant="outline" className={getStatusColor(doc.status)}>
                          {doc.status.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="font-semibold text-base mb-1 truncate">
                      {doc.number}
                    </div>
                    <div className="text-sm text-muted-foreground mb-3 truncate">
                      {doc.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{format(doc.createdAt, "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{doc.createdBy}</span>
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
