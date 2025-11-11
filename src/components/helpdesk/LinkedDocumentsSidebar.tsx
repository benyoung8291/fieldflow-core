import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, X, FileText, Calendar, DollarSign, ClipboardList, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface LinkedDocumentsSidebarProps {
  ticketId: string;
  ticket: any;
}

export function LinkedDocumentsSidebar({ ticketId, ticket }: LinkedDocumentsSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "service_order": return <ClipboardList className="h-3 w-3" />;
      case "appointment": return <Calendar className="h-3 w-3" />;
      case "quote": return <FileText className="h-3 w-3" />;
      case "invoice": return <DollarSign className="h-3 w-3" />;
      case "project": return <FileText className="h-3 w-3" />;
      case "task": return <CheckSquare className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getDocumentUrl = (type: string, id: string) => {
    switch (type) {
      case "service_order": return `/service-orders/${id}`;
      case "appointment": return `/appointments/${id}`;
      case "quote": return `/quotes/${id}`;
      case "invoice": return `/invoices/${id}`;
      case "project": return `/projects/${id}`;
      case "task": return `/tasks`;
      default: return "#";
    }
  };

  const groupedDocs = linkedDocs?.reduce((acc, doc) => {
    if (!acc[doc.document_type]) {
      acc[doc.document_type] = [];
    }
    acc[doc.document_type].push(doc);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="px-3 py-2 border-b">
        <h3 className="font-semibold text-sm mb-2">Linked Documents</h3>
        
        {/* Customer & Contact */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Customer</span>
            {ticket?.customer ? (
              <Badge variant="outline" className="text-xs h-4 px-1">
                {ticket.customer.name}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-5 text-xs px-2">
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Link
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Contact</span>
            {ticket?.contact ? (
              <Badge variant="outline" className="text-xs h-4 px-1">
                {ticket.contact.first_name} {ticket.contact.last_name}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-5 text-xs px-2">
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Link
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-2" />

        <Button variant="outline" size="sm" className="w-full h-6 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Link Document
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {groupedDocs && Object.entries(groupedDocs).map(([type, docs]) => (
            <div key={type}>
              <h4 className="text-xs font-medium mb-1.5 capitalize flex items-center gap-1.5">
                {getDocumentIcon(type)}
                {type.replace("_", " ")}s
                <Badge variant="secondary" className="text-xs h-4 px-1">
                  {(docs as any[]).length}
                </Badge>
              </h4>
              <div className="space-y-1">
                {(docs as any[]).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-2 py-1 rounded border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {getDocumentIcon(doc.document_type)}
                      <span className="text-xs truncate">{doc.document_id}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => window.open(getDocumentUrl(doc.document_type, doc.document_id), "_blank")}
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => unlinkMutation.mutate(doc.id)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(!groupedDocs || Object.keys(groupedDocs).length === 0) && (
            <div className="text-center text-xs text-muted-foreground py-6">
              No documents linked yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
