import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, X, FileText, Calendar, DollarSign, ClipboardList, CheckSquare, Users, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { LinkDocumentDialog } from "./LinkDocumentDialog";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);

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

  const groupedDocs = linkedDocs?.reduce((acc, doc) => {
    if (!acc[doc.document_type]) {
      acc[doc.document_type] = [];
    }
    acc[doc.document_type].push(doc);
    return acc;
  }, {} as Record<string, any[]>) || {};

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="px-3 py-3 border-b">
        <h3 className="font-semibold text-sm">Linked Documents</h3>
      </div>

      <ScrollArea className="flex-1 p-3">
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
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Link
                </Button>
              </div>
              {ticket?.customer ? (
                <p className="text-xs text-muted-foreground">{ticket.customer.name}</p>
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
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Link
                </Button>
              </div>
              {ticket?.contact ? (
                <p className="text-xs text-muted-foreground">
                  {ticket.contact.first_name} {ticket.contact.last_name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No contact linked</p>
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
                    onClick={() => setSelectedDocType(docType.type)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Link
                  </Button>
                </div>

                {hasLinkedDocs ? (
                  <div className="space-y-1.5 mt-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted group"
                      >
                        <button
                          onClick={() => navigate(docType.route(doc.document_id))}
                          className="flex-1 text-left"
                        >
                          <p className="text-xs font-medium truncate">
                            {doc.document_number || doc.document_id}
                          </p>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.description}
                            </p>
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => unlinkMutation.mutate(doc.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
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

      <LinkDocumentDialog
        ticketId={ticketId}
        open={!!selectedDocType}
        onOpenChange={(open) => !open && setSelectedDocType(null)}
        initialDocumentType={selectedDocType || undefined}
      />
    </div>
  );
}
