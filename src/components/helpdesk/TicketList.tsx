import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";

interface TicketListProps {
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  pipelineId?: string | null;
  filterAssignment?: "all" | "unassigned" | "assigned_to_me";
  filterArchived?: boolean;
}

export function TicketList({ selectedTicketId, onSelectTicket, pipelineId, filterAssignment = "all", filterArchived = false }: TicketListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Subscribe to realtime updates for ticket changes
  useEffect(() => {
    const channel = supabase
      .channel('helpdesk-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'helpdesk_tickets'
        },
        (payload) => {
          console.log('Ticket change detected:', payload);
          // Invalidate and refetch tickets when any change occurs
          queryClient.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["helpdesk-tickets", filterArchived],
    queryFn: async () => {
      let query = supabase
        .from("helpdesk_tickets" as any)
        .select(`
          *,
          customer:customers(name),
          contact:contacts(first_name, last_name),
          pipeline:helpdesk_pipelines(name, color),
          assigned_user:profiles!helpdesk_tickets_assigned_to_fkey(id, first_name, last_name),
          email_account:helpdesk_email_accounts(id, email_address)
        `)
        .eq("is_archived", filterArchived);

      const { data, error } = await query
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch linked document counts for each ticket
      const ticketsWithCounts = await Promise.all(
        (data || []).map(async (ticket: any) => {
          const { count } = await supabase
            .from("helpdesk_linked_documents" as any)
            .select("*", { count: 'exact', head: true })
            .eq("ticket_id", ticket.id);
          
          // Count entity links
          let entityLinkCount = 0;
          if (ticket.customer_id) entityLinkCount++;
          if (ticket.contact_id) entityLinkCount++;
          if (ticket.supplier_id) entityLinkCount++;
          if (ticket.lead_id) entityLinkCount++;
          
          return { 
            ...ticket, 
            linked_docs_count: (count || 0) + entityLinkCount
          };
        })
      );
      
      return ticketsWithCounts as any[];
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const filteredTickets = tickets?.filter(ticket => {
    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.sender_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPipeline = !pipelineId || ticket.pipeline_id === pipelineId;
    
    const matchesAssignment = 
      filterAssignment === "all" ? true :
      filterAssignment === "unassigned" ? !ticket.assigned_to :
      filterAssignment === "assigned_to_me" ? ticket.assigned_to === currentUser?.id :
      true;
    
    return matchesSearch && matchesPipeline && matchesAssignment;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "pending": return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "resolved": return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "closed": return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
      default: return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500/10 text-red-700 dark:text-red-400";
      case "high": return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
      case "normal": return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "low": return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
      default: return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  return (
    <div className="flex flex-col h-full border-r bg-background">
      <div className="px-3 py-2 border-b space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Button size="icon" variant="outline" className="h-7 w-7">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 text-center text-muted-foreground text-sm">Loading tickets...</div>
        ) : filteredTickets && filteredTickets.length > 0 ? (
          <div className="divide-y">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket.id)}
                className={cn(
                  "w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors flex flex-col justify-between border-b h-[100px]",
                  selectedTicketId === ticket.id && "bg-accent",
                  !ticket.is_read && "bg-muted/30"
                )}
              >
                {/* Header Row - Pipeline and Badges */}
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {ticket.pipeline && (
                      <>
                        <div 
                          className="h-1.5 w-1.5 rounded-full shrink-0" 
                          style={{ backgroundColor: ticket.pipeline.color }}
                        />
                        <span className="text-xs text-muted-foreground truncate">{ticket.pipeline.name}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ticket.linked_docs_count > 0 && (
                      <div className="flex items-center gap-0.5 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
                        <Link2 className="h-2.5 w-2.5" />
                        <span>{ticket.linked_docs_count}</span>
                      </div>
                    )}
                    <Badge variant="outline" className={cn("text-xs h-4 px-1.5", getPriorityColor(ticket.priority))}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs h-4 px-1.5", getStatusColor(ticket.status))}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>

                {/* Subject - Single line */}
                <h3 className="font-semibold text-sm truncate">
                  {ticket.subject}
                </h3>

                {/* Sender and Assignment - Single line */}
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {ticket.customer?.name || 
                     (ticket.contact ? `${ticket.contact.first_name} ${ticket.contact.last_name}` : 
                     ticket.external_email || "Unknown")}
                  </span>
                  {ticket.assigned_user && (
                    <span className="shrink-0 text-xs font-medium">
                      → {ticket.assigned_user.first_name}
                    </span>
                  )}
                </div>

                {/* Footer - Tags and Time */}
                <div className="flex items-center justify-between gap-2 w-full">
                  {ticket.tags && ticket.tags.length > 0 ? (
                    <div className="flex gap-1 flex-1 min-w-0 overflow-hidden">
                      {ticket.tags.slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs h-4 px-1.5 shrink-0">
                          {tag}
                        </Badge>
                      ))}
                      {ticket.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5 shrink-0">
                          +{ticket.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : <div className="flex-1" />}
                  
                  {ticket.last_message_at && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(ticket.last_message_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 text-center text-muted-foreground text-sm">
            {searchQuery ? "No tickets found" : "No tickets yet"}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
