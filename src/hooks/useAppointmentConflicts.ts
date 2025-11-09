import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, getDay, format, isWithinInterval } from "date-fns";

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

  const { data: schedules = [] } = useQuery({
    queryKey: ["worker-schedules-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_schedule")
        .select("*")
        .eq("is_active", true);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: unavailability = [] } = useQuery({
    queryKey: ["worker-unavailability-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_unavailability")
        .select("*");
      
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
    const dayOfWeek = getDay(startTime); // 0 = Sunday, 6 = Saturday
    const startTimeStr = format(startTime, "HH:mm");
    const endTimeStr = format(endTime, "HH:mm");
    const dateStr = format(startTime, "yyyy-MM-dd");

    // Check if worker has a schedule for this day
    const workerSchedule = schedules.find(
      s => s.worker_id === workerId && s.day_of_week === dayOfWeek
    );

    if (!workerSchedule) {
      return { 
        isAvailable: false, 
        reason: "Worker does not work on this day" 
      };
    }

    // Check if time is within worker's regular schedule
    if (startTimeStr < workerSchedule.start_time || endTimeStr > workerSchedule.end_time) {
      return { 
        isAvailable: false, 
        reason: `Worker's hours are ${workerSchedule.start_time} - ${workerSchedule.end_time}` 
      };
    }

    // Check if worker is unavailable during this period
    const workerUnavailability = unavailability.filter(
      u => u.worker_id === workerId
    );

    for (const unavail of workerUnavailability) {
      const unavailStart = new Date(unavail.start_date);
      const unavailEnd = new Date(unavail.end_date);
      
      // Check if appointment date falls within unavailable period
      if (isWithinInterval(startTime, { start: unavailStart, end: unavailEnd })) {
        // If specific times are set, check those too
        if (unavail.start_time && unavail.end_time) {
          if (startTimeStr >= unavail.start_time && endTimeStr <= unavail.end_time) {
            return { 
              isAvailable: false, 
              reason: unavail.reason || "Worker is unavailable during this time" 
            };
          }
        } else {
          // All day unavailability
          return { 
            isAvailable: false, 
            reason: unavail.reason || "Worker is unavailable on this date" 
          };
        }
      }
    }

    return { isAvailable: true };
  };

  return {
    checkConflict,
    checkAvailability,
  };
}