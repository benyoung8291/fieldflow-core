import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isWithinInterval, parseISO } from "date-fns";

export function useAppointmentConflicts() {
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .neq("status", "cancelled");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["worker-availability-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_availability")
        .select("*")
        .eq("is_available", true);
      
      if (error) throw error;
      return data;
    },
  });

  const checkConflict = (
    workerId: string | null,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string
  ): { hasConflict: boolean; reason?: string } => {
    // Check for overlapping appointments with same worker
    if (workerId) {
      const workerAppointments = appointments.filter(
        apt => apt.assigned_to === workerId && 
               apt.id !== excludeAppointmentId
      );

      for (const apt of workerAppointments) {
        const aptStart = parseISO(apt.start_time);
        const aptEnd = parseISO(apt.end_time);

        // Check if times overlap
        if (
          (startTime >= aptStart && startTime < aptEnd) ||
          (endTime > aptStart && endTime <= aptEnd) ||
          (startTime <= aptStart && endTime >= aptEnd)
        ) {
          return { 
            hasConflict: true, 
            reason: "Worker already has an appointment at this time" 
          };
        }
      }
    }

    return { hasConflict: false };
  };

  const checkAvailability = (
    workerId: string,
    startTime: Date,
    endTime: Date
  ): { isAvailable: boolean; reason?: string } => {
    const dateStr = startTime.toISOString().split('T')[0];
    const startTimeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);
    const endTimeStr = endTime.toTimeString().split(' ')[0].substring(0, 5);

    const workerAvailability = availability.filter(
      avail => avail.worker_id === workerId && avail.date === dateStr
    );

    if (workerAvailability.length === 0) {
      // Check preferred days from profiles
      return { 
        isAvailable: true, 
        reason: "No specific availability set, using default" 
      };
    }

    const isInAvailableSlot = workerAvailability.some(avail => {
      return startTimeStr >= avail.start_time && endTimeStr <= avail.end_time;
    });

    if (!isInAvailableSlot) {
      return { 
        isAvailable: false, 
        reason: "Worker is not available during this time" 
      };
    }

    return { isAvailable: true };
  };

  return {
    checkConflict,
    checkAvailability,
  };
}
