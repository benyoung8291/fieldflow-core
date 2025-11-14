import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TicketList } from "@/components/helpdesk/TicketList";
import { TicketTimeline } from "@/components/helpdesk/TicketTimeline";
import { LinkedDocumentsSidebar } from "@/components/helpdesk/LinkedDocumentsSidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function HelpDesk() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterAssignment, setFilterAssignment] = useState<"all" | "unassigned" | "assigned_to_me">("all");
  const [filterArchived, setFilterArchived] = useState<boolean>(false);

  // Handle ticket selection from URL params (e.g., from search)
  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId && ticketId !== selectedTicketId) {
      // Check if the ticket is archived and enable filter if needed
      const checkAndSelectTicket = async () => {
        const { data: ticketData } = await supabase
          .from("helpdesk_tickets")
          .select("is_archived")
          .eq("id", ticketId)
          .single();
        
        if (ticketData?.is_archived) {
          setFilterArchived(true);
        }
        
        handleSelectTicket(ticketId);
      };
      
      checkAndSelectTicket();
      // Clear the URL param after selecting
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const { data: pipelines } = useQuery({
    queryKey: ["helpdesk-pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_pipelines" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: emailAccounts } = useQuery({
    queryKey: ["helpdesk-email-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_email_accounts" as any)
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: ticket } = useQuery({
    queryKey: ["helpdesk-ticket", selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null;
      
      const { data, error } = await supabase
        .from("helpdesk_tickets" as any)
        .select(`
          *,
          customer:customers(id, name),
          contact:customer_contacts(id, first_name, last_name, email),
          assigned_user:profiles!helpdesk_tickets_assigned_to_fkey(id, first_name, last_name),
          email_account:helpdesk_email_accounts(id, email_address)
        `)
        .eq("id", selectedTicketId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!selectedTicketId,
  });

  const handleSelectTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    
    // Mark ticket as read when opened
    await supabase
      .from("helpdesk_tickets")
      .update({ is_read: true })
      .eq("id", ticketId);
    
    // Also mark as read in Microsoft (fire and forget)
    supabase.functions.invoke("microsoft-mark-read", {
      body: { ticketId }
    }).catch(err => console.error("Failed to sync read status to Microsoft:", err));
    
    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
  };

  const handleSyncEmails = async () => {
    if (!emailAccounts || emailAccounts.length === 0) {
      toast({
        title: "No email accounts",
        description: "Please connect email accounts in settings first",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    
    // Refetch email accounts first to get latest IDs
    await queryClient.invalidateQueries({ queryKey: ["helpdesk-email-accounts-active"] });
    const freshAccounts = await queryClient.fetchQuery({
      queryKey: ["helpdesk-email-accounts-active"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("helpdesk_email_accounts" as any)
          .select("*")
          .eq("is_active", true);
        if (error) throw error;
        return data as any[];
      },
    });
    
    if (!freshAccounts || freshAccounts.length === 0) {
      toast({
        title: "No active email accounts",
        description: "Please check your email account settings",
        variant: "destructive",
      });
      setIsSyncing(false);
      return;
    }
    
    try {
      let totalSynced = 0;
      
      for (const account of freshAccounts) {
        // Sync inbox
        const { data: inboxData, error: inboxError } = await supabase.functions.invoke(
          "microsoft-sync-emails",
          {
            body: { emailAccountId: account.id },
          }
        );

        if (inboxError) throw inboxError;
        totalSynced += inboxData.syncedCount || 0;

        // Sync archive if viewing archived
        if (filterArchived) {
          const { data: archiveData, error: archiveError } = await supabase.functions.invoke(
            "microsoft-sync-archived-emails",
            {
              body: { emailAccountId: account.id },
            }
          );

          if (archiveError) throw archiveError;
          totalSynced += archiveData.syncedCount || 0;
        }
      }

      toast({
        title: "Email sync complete",
        description: `Synced ${totalSynced} new tickets`,
      });

      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    } catch (error: any) {
      toast({
        title: "Failed to sync emails",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('helpdesk-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'helpdesk_tickets'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
          if (selectedTicketId) {
            queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", selectedTicketId] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'helpdesk_messages'
        },
        () => {
          if (selectedTicketId) {
            queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", selectedTicketId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicketId, queryClient]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full -mx-3 sm:-mx-6 lg:-mx-8">
        {/* Header with Pipeline Selector and Sync */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Help Desk</h1>
            <Select value={selectedPipelineId || "all"} onValueChange={(value) => setSelectedPipelineId(value === "all" ? null : value)}>
              <SelectTrigger className="w-[180px] h-7 text-xs">
                <SelectValue placeholder="All Pipelines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipelines</SelectItem>
                {pipelines?.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: pipeline.color }} />
                      {pipeline.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Filter className="h-3 w-3 mr-1.5" />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Assignment</Label>
                    <Select value={filterAssignment} onValueChange={(value: any) => setFilterAssignment(value)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tickets</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        <SelectItem value="assigned_to_me">Assigned to Me</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Archived</Label>
                    <Switch checked={filterArchived} onCheckedChange={setFilterArchived} />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleSyncEmails} disabled={isSyncing} size="sm" className="h-7 text-xs">
            <RefreshCw className={`h-3 w-3 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync"}
          </Button>
        </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: Ticket List */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <TicketList 
            selectedTicketId={selectedTicketId} 
            onSelectTicket={handleSelectTicket}
            pipelineId={selectedPipelineId}
            filterAssignment={filterAssignment}
            filterArchived={filterArchived}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle: Timeline View */}
        <ResizablePanel defaultSize={50} minSize={35}>
          {selectedTicketId ? (
            <TicketTimeline ticketId={selectedTicketId} ticket={ticket} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">No ticket selected</p>
                <p className="text-sm">Select a ticket from the list to view details</p>
              </div>
            </div>
          )}
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Linked Documents */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          {selectedTicketId ? (
            <LinkedDocumentsSidebar ticketId={selectedTicketId} ticket={ticket} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground p-4">
              <p className="text-sm text-center">Linked documents will appear here</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
      </div>
    </DashboardLayout>
  );
}
