import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAppointmentRequests(appointmentId: string | null) {
  return useQuery({
    queryKey: ["appointment-requests", appointmentId],
    queryFn: async () => {
      if (!appointmentId) return [];

      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select(`
          id,
          ticket_number,
          subject,
          status,
          created_at,
          ticket_markups (
            id,
            status,
            notes,
            photo_url,
            response_notes,
            response_photos
          )
        `)
        .eq("appointment_id", appointmentId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!appointmentId,
  });
}
