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
      case "service_order": return <ClipboardList className="h-4 w-4" />;
      case "appointment": return <Calendar className="h-4 w-4" />;
      case "quote": return <FileText className="h-4 w-4" />;
      case "invoice": return <DollarSign className="h-4 w-4" />;
      case "project": return <FileText className="h-4 w-4" />;
      case "task": return <CheckSquare className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
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
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3">Linked Documents</h3>
        
        {/* Customer & Contact */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Customer</span>
            {ticket?.customer ? (
              <Badge variant="outline" className="text-xs">
                {ticket.customer.name}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Link
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Contact</span>
            {ticket?.contact ? (
              <Badge variant="outline" className="text-xs">
                {ticket.contact.first_name} {ticket.contact.last_name}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Link
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-3" />

        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Link Document
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {groupedDocs && Object.entries(groupedDocs).map(([type, docs]) => (
            <div key={type}>
              <h4 className="text-sm font-medium mb-2 capitalize flex items-center gap-2">
                {getDocumentIcon(type)}
                {type.replace("_", " ")}s
                <Badge variant="secondary" className="text-xs">
                  {(docs as any[]).length}
                </Badge>
              </h4>
              <div className="space-y-2">
                {(docs as any[]).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getDocumentIcon(doc.document_type)}
                      <span className="text-sm truncate">{doc.document_id}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(getDocumentUrl(doc.document_type, doc.document_id), "_blank")}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => unlinkMutation.mutate(doc.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(!groupedDocs || Object.keys(groupedDocs).length === 0) && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No documents linked yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
