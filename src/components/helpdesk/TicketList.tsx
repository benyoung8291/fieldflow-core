import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus, Link2, Archive, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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

  const { data: users } = useQuery({
    queryKey: ["users-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const archiveTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({ is_archived: !filterArchived })
        .eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      toast({
        title: filterArchived ? "Ticket unarchived" : "Ticket archived",
        description: filterArchived ? "The ticket has been moved back to inbox" : "The ticket has been archived",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${filterArchived ? "unarchive" : "archive"} ticket: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: async ({ ticketId, userId }: { ticketId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({ assigned_to: userId })
        .eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      toast({
        title: "Ticket assigned",
        description: "The ticket assignment has been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to assign ticket: ${error.message}`,
        variant: "destructive",
      });
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
    <div className="flex flex-col h-full border-r bg-gradient-to-b from-background to-muted/5">
      {/* Enhanced Header */}
      <div className="px-4 py-3 border-b bg-background/80 backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/50 border-muted-foreground/20 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <Button 
            size="icon" 
            variant="outline" 
            className="h-9 w-9 hover-lift transition-all hover:bg-primary hover:text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="flex gap-2">
                  <div className="h-5 bg-muted rounded w-16"></div>
                  <div className="h-5 bg-muted rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTickets && filteredTickets.length > 0 ? (
          <div className="p-2 space-y-1">
            {filteredTickets.map((ticket, index) => (
              <ContextMenu key={ticket.id}>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => onSelectTicket(ticket.id)}
                    style={{ animationDelay: `${index * 30}ms` }}
                    className={cn(
                      "w-full px-4 py-3 text-left rounded-lg transition-all duration-200 flex flex-col gap-2 group relative overflow-hidden animate-fade-in-up",
                      "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      selectedTicketId === ticket.id 
                        ? "bg-primary/10 border-2 border-primary/30 shadow-sm" 
                        : "bg-background hover:bg-accent/30 border border-border/50",
                      !ticket.is_read && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary before:rounded-l-lg"
                    )}
                  >
                {/* Top Row - Subject and Time */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className={cn(
                    "font-semibold text-sm line-clamp-2 flex-1 min-w-0 leading-snug transition-colors group-hover:text-primary",
                    !ticket.is_read && "text-foreground font-bold",
                    selectedTicketId === ticket.id && "text-primary"
                  )}>
                    {ticket.subject}
                  </h3>
                  <span className="text-xs text-muted-foreground/80 whitespace-nowrap shrink-0 font-medium transition-colors group-hover:text-foreground/70">
                    {ticket.last_message_at 
                      ? formatDistanceToNow(new Date(ticket.last_message_at), { addSuffix: true }).replace('about ', '').replace(' ago', '')
                      : 'New'}
                  </span>
                </div>

                {/* Second Row - Sender/Customer and Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 font-medium">
                    {ticket.customer?.name || 
                     (ticket.contact ? `${ticket.contact.first_name} ${ticket.contact.last_name}` : 
                     ticket.external_email || "Unknown")}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] h-5 px-2 font-semibold transition-all",
                        getStatusColor(ticket.status)
                      )}
                    >
                      {ticket.status}
                    </Badge>
                  </div>
                </div>

                {/* Third Row - Metadata */}
                <div className="flex items-center justify-between gap-2 text-[10px] pt-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                    {/* Pipeline indicator */}
                    {ticket.pipeline && (
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <div 
                          className="h-2 w-2 rounded-full transition-all" 
                          style={{ backgroundColor: ticket.pipeline.color }}
                        />
                        <span className="text-muted-foreground/80 truncate max-w-[90px] font-medium">
                          {ticket.pipeline.name}
                        </span>
                      </div>
                    )}
                    
                    {/* Priority badge */}
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] h-5 px-2 shrink-0 font-semibold transition-all",
                        getPriorityColor(ticket.priority)
                      )}
                    >
                      {ticket.priority}
                    </Badge>

                    {/* Tags */}
                    {ticket.tags && ticket.tags.length > 0 && (
                      <div className="hidden md:flex gap-1.5">
                        {ticket.tags.slice(0, 1).map((tag: string) => (
                          <Badge 
                            key={tag} 
                            variant="secondary" 
                            className="text-[10px] h-5 px-2 font-medium"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {ticket.tags.length > 1 && (
                          <Badge 
                            variant="secondary" 
                            className="text-[10px] h-5 px-2 font-medium"
                          >
                            +{ticket.tags.length - 1}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side indicators */}
                  <div className="flex items-center gap-2 shrink-0">
                    {ticket.assigned_user && (
                      <div className="flex items-center gap-1 text-muted-foreground/80">
                        <span className="font-semibold text-[11px]">
                          {ticket.assigned_user.first_name}
                        </span>
                      </div>
                    )}
                    {ticket.linked_docs_count > 0 && (
                      <div className="flex items-center gap-1 bg-primary/15 text-primary px-2 py-1 rounded-md font-semibold transition-all group-hover:bg-primary/20">
                        <Link2 className="h-3 w-3" />
                        <span className="text-[11px]">{ticket.linked_docs_count}</span>
                      </div>
                    )}
                  </div>
                </div>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => archiveTicketMutation.mutate(ticket.id)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {filterArchived ? "Unarchive" : "Archive"}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Assign to
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                      <ContextMenuItem
                        onClick={() => assignTicketMutation.mutate({ ticketId: ticket.id, userId: null })}
                      >
                        Unassign
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      {users?.map((user) => (
                        <ContextMenuItem
                          key={user.id}
                          onClick={() => assignTicketMutation.mutate({ ticketId: ticket.id, userId: user.id })}
                        >
                          {user.first_name} {user.last_name}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {searchQuery ? "No tickets found" : "No tickets yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? "Try adjusting your search" : "Tickets will appear here when received"}
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
