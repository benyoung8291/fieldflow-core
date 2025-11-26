import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAppointmentConfirmations(appointmentId?: string) {
  const queryClient = useQueryClient();

  const { data: confirmations = [], isLoading } = useQuery({
    queryKey: ["appointment-confirmations", appointmentId],
    queryFn: async () => {
      if (!appointmentId) return [];
      
      const { data, error } = await supabase
        .from("appointment_worker_confirmations")
        .select(`
          *,
          worker:profiles(id, first_name, last_name)
        `)
        .eq("appointment_id", appointmentId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!appointmentId,
  });

  const notifyWorkersMutation = useMutation({
    mutationFn: async ({ appointmentId, workerIds }: { appointmentId: string; workerIds: string[] }) => {
      const { data: appointment } = await supabase
        .from("appointments")
        .select("title, start_time, end_time")
        .eq("id", appointmentId)
        .single();

      if (!appointment) throw new Error("Appointment not found");

      // Update notification timestamp for pending confirmations
      const { error } = await supabase
        .from("appointment_worker_confirmations")
        .update({ notified_at: new Date().toISOString() })
        .eq("appointment_id", appointmentId)
        .in("worker_id", workerIds)
        .eq("status", "pending");

      if (error) throw error;

      // Send push notifications via edge function
      const { error: notifyError } = await supabase.functions.invoke("send-appointment-confirmation-notification", {
        body: {
          appointmentId,
          workerIds,
          appointmentTitle: appointment.title,
          startTime: appointment.start_time,
          endTime: appointment.end_time,
        },
      });

      if (notifyError) {
        console.error("Error sending notifications:", notifyError);
        throw notifyError;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-confirmations"] });
      toast.success("Workers have been notified");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to notify workers");
    },
  });

  const confirmAppointmentMutation = useMutation({
    mutationFn: async ({ confirmationId, status }: { confirmationId: string; status: "confirmed" | "declined" }) => {
      const { error } = await supabase
        .from("appointment_worker_confirmations")
        .update({
          status,
          confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
        })
        .eq("id", confirmationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-confirmations"] });
      toast.success("Confirmation updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update confirmation");
    },
  });

  return {
    confirmations,
    isLoading,
    notifyWorkers: notifyWorkersMutation.mutate,
    confirmAppointment: confirmAppointmentMutation.mutate,
    isNotifying: notifyWorkersMutation.isPending,
  };
}
