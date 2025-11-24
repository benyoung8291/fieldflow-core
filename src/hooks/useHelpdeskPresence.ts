import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useHelpdeskPresence(ticketId: string | null) {
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      return {
        id: user.id,
        name: profile
          ? `${profile.first_name} ${profile.last_name}`
          : user.email || "Unknown User",
      };
    },
  });

  const { data: ticket } = useQuery({
    queryKey: ["helpdesk-ticket-for-presence", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("subject, ticket_number")
        .eq("id", ticketId)
        .single();

      if (error) throw error;
      return data as { subject: string; ticket_number: string } | null;
    },
    enabled: !!ticketId,
  });

  useEffect(() => {
    if (!currentUser) return;

    const presenceChannel = supabase.channel("dashboard-presence");

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const currentPath = window.location.pathname + window.location.search;
        const pageName = ticketId && ticket
          ? `Help Desk: ${ticket.ticket_number || ticket.subject.substring(0, 30)}`
          : "Help Desk";

        await presenceChannel.track({
          user_id: currentUser.id,
          user_name: currentUser.name,
          current_page: pageName,
          current_path: currentPath,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUser, ticketId, ticket]);
}
