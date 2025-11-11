import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface LinkedHelpdeskTicketsTabProps {
  documentType: string;
  documentId: string;
}

export function LinkedHelpdeskTicketsTab({ documentType, documentId }: LinkedHelpdeskTicketsTabProps) {
  const { data: linkedTickets, isLoading } = useQuery({
    queryKey: ["helpdesk-linked-tickets", documentType, documentId],
    queryFn: async () => {
      const { data: links, error: linksError } = await supabase
        .from("helpdesk_linked_documents")
        .select("ticket_id")
        .eq("document_type", documentType)
        .eq("document_id", documentId);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      const ticketIds = links.map(l => l.ticket_id);

      const { data: tickets, error: ticketsError } = await supabase
        .from("helpdesk_tickets")
        .select(`
          id,
          ticket_number,
          subject,
          status,
          priority,
          created_at,
          sender_name,
          sender_email,
          assigned_to
        `)
        .in("id", ticketIds)
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      // Fetch message counts and assigned user names for each ticket
      const ticketsWithCounts = await Promise.all(
        (tickets || []).map(async (ticket) => {
          const { count } = await supabase
            .from("helpdesk_messages")
            .select("*", { count: "exact", head: true })
            .eq("ticket_id", ticket.id);

          let assignedToName = "Unassigned";
          if (ticket.assigned_to) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", ticket.assigned_to)
              .single();
            
            if (profile) {
              assignedToName = `${profile.first_name} ${profile.last_name}`;
            }
          }

          return { ...ticket, messageCount: count || 0, assignedToName };
        })
      );

      return ticketsWithCounts;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!linkedTickets || linkedTickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No help desk conversations linked to this document</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "in_progress":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "closed":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "normal":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "low":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4 p-1">
        {linkedTickets.map((ticket) => (
          <Card key={ticket.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 mb-2">
                    <span className="text-muted-foreground font-mono text-sm">
                      #{ticket.ticket_number}
                    </span>
                    <span className="truncate">{ticket.subject}</span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className={getStatusColor(ticket.status)}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>{ticket.messageCount} messages</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">From</p>
                  <p className="font-medium">{ticket.sender_name || ticket.sender_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Assigned To</p>
                  <p className="font-medium">
                    {ticket.assignedToName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Created</p>
                  <p className="font-medium">
                    {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                <div className="flex items-end justify-end">
                  <a
                    href={`/helpdesk?ticket=${ticket.id}`}
                    className="text-primary hover:underline text-sm font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Conversation →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
