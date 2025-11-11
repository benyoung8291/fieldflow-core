import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TicketList } from "@/components/helpdesk/TicketList";
import { TicketTimeline } from "@/components/helpdesk/TicketTimeline";
import { LinkedDocumentsSidebar } from "@/components/helpdesk/LinkedDocumentsSidebar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function HelpDesk() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-background px-6 py-3">
        <h1 className="text-2xl font-semibold">Help Desk</h1>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left: Ticket List */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <TicketList 
            selectedTicketId={selectedTicketId} 
            onSelectTicket={setSelectedTicketId}
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
  );
}
