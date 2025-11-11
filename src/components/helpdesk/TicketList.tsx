import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface TicketListProps {
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  pipelineId?: string | null;
}

export function TicketList({ selectedTicketId, onSelectTicket, pipelineId }: TicketListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["helpdesk-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_tickets" as any)
        .select(`
          *,
          customer:customers(name),
          contact:customer_contacts(first_name, last_name),
          pipeline:helpdesk_pipelines(name, color)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const filteredTickets = tickets?.filter(ticket => {
    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.external_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPipeline = !pipelineId || ticket.pipeline_id === pipelineId;
    
    return matchesSearch && matchesPipeline;
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
                  "w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors",
                  selectedTicketId === ticket.id && "bg-accent"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">
                          {ticket.ticket_number}
                        </span>
                        <Badge variant="outline" className={cn("text-xs h-4 px-1", getPriorityColor(ticket.priority))}>
                          {ticket.priority}
                        </Badge>
                      </div>
                      <p className="font-medium text-xs truncate">{ticket.subject}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0 h-4 px-1", getStatusColor(ticket.status))}>
                      {ticket.status}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {ticket.customer ? (
                      <p className="truncate">{ticket.customer.name}</p>
                    ) : ticket.contact ? (
                      <p className="truncate">{ticket.contact.first_name} {ticket.contact.last_name}</p>
                    ) : (
                      <p className="truncate">{ticket.external_email || "Unknown"}</p>
                    )}
                    
                    {ticket.last_message_at && (
                      <p className="text-xs">
                        {formatDistanceToNow(new Date(ticket.last_message_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>

                  {ticket.pipeline && (
                    <div className="flex items-center gap-1">
                      <div 
                        className="h-1.5 w-1.5 rounded-full" 
                        style={{ backgroundColor: ticket.pipeline.color }}
                      />
                      <span className="text-xs text-muted-foreground">{ticket.pipeline.name}</span>
                    </div>
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
