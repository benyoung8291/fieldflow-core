import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TicketList } from "@/components/helpdesk/TicketList";
import { TicketTimeline } from "@/components/helpdesk/TicketTimeline";
import { LinkedDocumentsSidebar } from "@/components/helpdesk/LinkedDocumentsSidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HelpDesk() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
          assigned_user:profiles!helpdesk_tickets_assigned_to_fkey(id, first_name, last_name)
        `)
        .eq("id", selectedTicketId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!selectedTicketId,
  });

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
        const { data, error } = await supabase.functions.invoke(
          "microsoft-sync-emails",
          {
            body: { emailAccountId: account.id },
          }
        );

        if (error) throw error;
        totalSynced += data.syncedCount || 0;
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

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header with Pipeline Selector and Sync */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Help Desk</h1>
            <Select value={selectedPipelineId || "all"} onValueChange={(value) => setSelectedPipelineId(value === "all" ? null : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Pipelines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipelines</SelectItem>
                {pipelines?.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: pipeline.color }} />
                      {pipeline.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSyncEmails} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Emails"}
          </Button>
        </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left: Ticket List */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <TicketList 
            selectedTicketId={selectedTicketId} 
            onSelectTicket={setSelectedTicketId}
            pipelineId={selectedPipelineId}
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
