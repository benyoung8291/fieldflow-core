import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus, Link2, Archive, UserPlus, Mail, MailOpen, Trash2, Reply, Forward, Flag, FolderInput, CheckSquare, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect, useCallback } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MailboxFolder = 
  | "inbox" 
  | "sent" 
  | "drafts" 
  | "archive" 
  | "deleted" 
  | "junk"
  | "starred"
  | "all";

interface TicketListProps {
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  pipelineId?: string | null;
  filterAssignment?: "all" | "unassigned" | "assigned_to_me";
  filterUserId?: string | null;
  filterArchived?: boolean;
  selectedFolder?: MailboxFolder;
  isRequestsPipeline?: boolean;
  onCreateMarkupRequest?: () => void;
}

export function TicketList({ 
  selectedTicketId, 
  onSelectTicket, 
  pipelineId, 
  filterAssignment = "assigned_to_me", 
  filterUserId = null,
  filterArchived = false,
  selectedFolder = "inbox",
  isRequestsPipeline = false,
  onCreateMarkupRequest
}: TicketListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
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
          email_account:helpdesk_email_accounts(id, email_address),
          appointment:appointments(id, appointment_number)
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
    queryKey: ["users-for-assignment", pipelineId],
    queryFn: async () => {
      if (!currentUser) return [];

      if (pipelineId) {
        // Get only users assigned to this pipeline
        const { data, error } = await supabase
          .from("helpdesk_pipeline_users")
          .select("user_id, profiles:user_id(id, first_name, last_name)")
          .eq("pipeline_id", pipelineId);
        
        if (error) throw error;
        return data?.map(d => d.profiles).filter(Boolean) as any[];
      } else {
        // No pipeline selected - get all users (existing behavior)
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .order("first_name");
        if (error) throw error;
        return data as any[];
      }
    },
    enabled: !!currentUser,
  });

  const archiveTicketMutation = useMutation({
    mutationFn: async (ticketIds: string[]) => {
      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({ is_archived: !filterArchived })
        .in("id", ticketIds);
      if (error) throw error;
    },
    onSuccess: (_, ticketIds) => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      setSelectedTicketIds(new Set());
      toast({
        title: filterArchived ? "Tickets unarchived" : "Tickets archived",
        description: `${ticketIds.length} ticket(s) ${filterArchived ? "moved back to inbox" : "archived"}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${filterArchived ? "unarchive" : "archive"} tickets: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async ({ ticketIds, isRead }: { ticketIds: string[]; isRead: boolean }) => {
      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({ is_read: isRead })
        .in("id", ticketIds);
      if (error) throw error;
    },
    onSuccess: (_, { ticketIds, isRead }) => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      setSelectedTicketIds(new Set());
      toast({
        title: isRead ? "Marked as read" : "Marked as unread",
        description: `${ticketIds.length} ticket(s) updated`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update tickets: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketIds: string[]) => {
      const { error } = await supabase
        .from("helpdesk_tickets")
        .delete()
        .in("id", ticketIds);
      if (error) throw error;
    },
    onSuccess: (_, ticketIds) => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      setSelectedTicketIds(new Set());
      toast({
        title: "Tickets deleted",
        description: `${ticketIds.length} ticket(s) permanently deleted`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete tickets: ${error.message}`,
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
    
    // Assignment filtering - check both filterAssignment and filterUserId
    const matchesAssignment = (() => {
      // If a specific user is selected, filter by that user
      if (filterUserId) {
        return ticket.assigned_to === filterUserId;
      }
      
      // Otherwise use the quick filter
      if (filterAssignment === "all") return true;
      if (filterAssignment === "unassigned") return !ticket.assigned_to;
      if (filterAssignment === "assigned_to_me") return ticket.assigned_to === currentUser?.id;
      return true;
    })();
    
    // Folder filtering
    const matchesFolder = (() => {
      switch (selectedFolder) {
        case "all":
          return true;
        case "inbox":
          return !ticket.is_archived && ticket.status !== "deleted";
        case "sent":
          // Sent by current user - check if created by current user or sent from their account
          return ticket.created_by === currentUser?.id;
        case "drafts":
          return ticket.status === "draft";
        case "archive":
          return ticket.is_archived;
        case "deleted":
          return ticket.status === "deleted";
        case "junk":
          return ticket.status === "junk" || ticket.is_spam;
        case "starred":
          return ticket.is_starred;
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesPipeline && matchesAssignment && matchesFolder;
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

  const handleTicketClick = useCallback((ticketId: string, index: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+Click: Toggle selection
      event.preventDefault();
      setSelectedTicketIds(prev => {
        const next = new Set(prev);
        if (next.has(ticketId)) {
          next.delete(ticketId);
        } else {
          next.add(ticketId);
        }
        return next;
      });
      setLastSelectedIndex(index);
    } else if (event.shiftKey && lastSelectedIndex !== null && filteredTickets) {
      // Shift+Click: Range selection
      event.preventDefault();
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      setSelectedTicketIds(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(filteredTickets[i].id);
        }
        return next;
      });
    } else {
      // Normal click: Clear selection and select ticket
      setSelectedTicketIds(new Set());
      setLastSelectedIndex(index);
      onSelectTicket(ticketId);
    }
  }, [lastSelectedIndex, filteredTickets, onSelectTicket]);

  const handleSelectAll = useCallback(() => {
    if (filteredTickets) {
      setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)));
    }
  }, [filteredTickets]);

  const handleClearSelection = useCallback(() => {
    setSelectedTicketIds(new Set());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      }
      if (e.key === 'Escape') {
        handleClearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectAll, handleClearSelection]);

  const handleBulkArchive = () => {
    archiveTicketMutation.mutate(Array.from(selectedTicketIds));
  };

  const handleBulkMarkRead = (isRead: boolean) => {
    markAsReadMutation.mutate({ ticketIds: Array.from(selectedTicketIds), isRead });
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to permanently delete ${selectedTicketIds.size} ticket(s)?`)) {
      deleteTicketMutation.mutate(Array.from(selectedTicketIds));
    }
  };

  return (
    <div className="flex flex-col h-full border-r bg-background">
      {/* Enhanced Header */}
      <div className="px-2 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 space-y-3">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="icon" 
                variant="outline" 
                className="h-9 w-9 hover-lift transition-all hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCreateMarkupRequest}>
                Create Markup Request
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedTicketIds.size > 0 && (
        <div className="px-2 py-2 border-b bg-primary/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedTicketIds.size} selected
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearSelection}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleBulkMarkRead(true)}
              className="h-7 text-xs"
            >
              <MailOpen className="h-3 w-3 mr-1" />
              Read
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleBulkMarkRead(false)}
              className="h-7 text-xs"
            >
              <Mail className="h-3 w-3 mr-1" />
              Unread
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleBulkArchive}
              className="h-7 text-xs"
            >
              <Archive className="h-3 w-3 mr-1" />
              {filterArchived ? "Unarchive" : "Archive"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleBulkDelete}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-3 p-3 bg-muted/30 rounded-lg">
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
                    onClick={(e) => handleTicketClick(ticket.id, index, e)}
                    style={{ animationDelay: `${index * 30}ms` }}
                    className={cn(
                      "w-full px-3 py-3 text-left rounded-lg transition-all duration-200 flex flex-col gap-2 group relative overflow-hidden animate-fade-in-up",
                      "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      selectedTicketId === ticket.id 
                        ? "bg-primary/10 border-2 border-primary/30 shadow-sm" 
                        : selectedTicketIds.has(ticket.id)
                        ? "bg-primary/5 border-2 border-primary/20 shadow-sm"
                        : "bg-background hover:bg-accent/30 border border-border/50",
                      !ticket.is_read && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary before:rounded-l-lg"
                    )}
                  >
                {/* Time - Pinned to top right */}
                <div className="absolute top-3 right-4">
                  <span className="text-xs text-muted-foreground/80 whitespace-nowrap font-medium transition-colors group-hover:text-foreground/70">
                    {ticket.last_message_at 
                      ? formatDistanceToNow(new Date(ticket.last_message_at), { addSuffix: true }).replace('about ', '').replace(' ago', '')
                      : 'New'}
                  </span>
                </div>

                {/* Top Row - Subject */}
                <div className="pr-16">
                  <h3 className={cn(
                    "font-semibold text-sm line-clamp-2 leading-snug transition-colors group-hover:text-primary",
                    !ticket.is_read && "text-foreground font-bold",
                    selectedTicketId === ticket.id && "text-primary"
                  )}>
                    {ticket.subject}
                  </h3>
                </div>

                {/* Second Row - Sender/Customer */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 font-medium">
                    {ticket.customer?.name || 
                     (ticket.contact ? `${ticket.contact.first_name} ${ticket.contact.last_name}` : 
                     ticket.external_email || "Unknown")}
                  </span>
                </div>

                {/* Assignment Row - Show appointment number for Requests pipeline */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {isRequestsPipeline && ticket.appointment?.appointment_number ? (
                      <span className="text-primary">
                        Appointment: {ticket.appointment.appointment_number}
                      </span>
                    ) : ticket.assigned_user ? (
                      <span className="text-primary">
                        Assigned to {ticket.assigned_user.first_name} {ticket.assigned_user.last_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">Unassigned</span>
                    )}
                  </span>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center justify-between gap-2 text-[10px] pt-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                    {/* Status badge */}
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] h-5 px-2 font-semibold transition-all shrink-0",
                        getStatusColor(ticket.status)
                      )}
                    >
                      {ticket.status}
                    </Badge>

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
                <ContextMenuContent className="w-56">
                  <ContextMenuItem onClick={() => onSelectTicket(ticket.id)}>
                    <MailOpen className="mr-2 h-4 w-4" />
                    Open
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => markAsReadMutation.mutate({ ticketIds: [ticket.id], isRead: !ticket.is_read })}
                  >
                    {ticket.is_read ? (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Mark as unread
                      </>
                    ) : (
                      <>
                        <MailOpen className="mr-2 h-4 w-4" />
                        Mark as read
                      </>
                    )}
                  </ContextMenuItem>
                  
                  {!isRequestsPipeline && (
                    <>
                      <ContextMenuItem>
                        <Flag className="mr-2 h-4 w-4" />
                        Flag
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem>
                        <Reply className="mr-2 h-4 w-4" />
                        Reply
                      </ContextMenuItem>
                      <ContextMenuItem>
                        <Forward className="mr-2 h-4 w-4" />
                        Forward
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <FolderInput className="mr-2 h-4 w-4" />
                          Move to
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                          <ContextMenuItem>Inbox</ContextMenuItem>
                          <ContextMenuItem>Important</ContextMenuItem>
                          <ContextMenuItem>Spam</ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </>
                  )}
                  {isRequestsPipeline && <ContextMenuSeparator />}
                  <ContextMenuItem
                    onClick={() => archiveTicketMutation.mutate([ticket.id])}
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
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      if (confirm('Are you sure you want to permanently delete this ticket?')) {
                        deleteTicketMutation.mutate([ticket.id]);
                      }
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </ContextMenuItem>
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
