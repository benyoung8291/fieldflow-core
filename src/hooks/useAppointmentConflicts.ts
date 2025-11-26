import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, getDay, format, isWithinInterval, startOfDay, endOfDay } from "date-fns";

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

  const { data: seasonalAvailability = [] } = useQuery({
    queryKey: ["worker-seasonal-availability-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_seasonal_availability")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: seasonalDates = [] } = useQuery({
    queryKey: ["worker-seasonal-dates-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_seasonal_availability_dates")
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
  ): { isAvailable: boolean; reason?: string; availablePeriods?: string[] } => {
    const dayOfWeek = getDay(startTime); // 0 = Sunday, 6 = Saturday
    const startTimeStr = format(startTime, "HH:mm");
    const endTimeStr = format(endTime, "HH:mm");
    const dateStr = format(startTime, "yyyy-MM-dd");

    // Check if this is a day-level check (checking a large time range like 9-5 for calendar display)
    const isDayLevelCheck = (endTime.getTime() - startTime.getTime()) >= (6 * 60 * 60 * 1000); // 6+ hours

    // FIRST: Check if there's a seasonal availability period that covers this date
    const workerSeasonalPeriod = seasonalAvailability.find(
      sa => sa.worker_id === workerId &&
            dateStr >= sa.start_date &&
            dateStr <= sa.end_date
    );

    if (workerSeasonalPeriod) {
      // Check if worker has specific availability set for this date
      const dateAvailability = seasonalDates.find(
        sd => sd.seasonal_availability_id === workerSeasonalPeriod.id &&
              sd.date === dateStr
      );

      if (!dateAvailability || !dateAvailability.periods || dateAvailability.periods.length === 0) {
        return {
          isAvailable: false,
          reason: `Worker is not available on this date (${workerSeasonalPeriod.season_name})`
        };
      }

      // Check if the appointment time falls within the available periods
      const periods = dateAvailability.periods;
      const isAnytime = periods.includes('anytime');
      
      if (isAnytime) {
        // Worker is available all day during this seasonal period
        return { isAvailable: true, availablePeriods: ['anytime'] };
      }

      // For day-level checks (like calendar view), if they have ANY periods, show as available
      if (isDayLevelCheck) {
        const periodLabels = periods.map(p => {
          const labels: Record<string, string> = {
            morning: 'Morning',
            afternoon: 'Afternoon',
            evening: 'Evening'
          };
          return labels[p] || p;
        });
        
        return {
          isAvailable: true,
          reason: `Available: ${periodLabels.join(', ')}`,
          availablePeriods: periods
        };
      }

      // For specific time checks (like when scheduling an appointment)
      // Define time ranges for each period
      const periodRanges: Record<string, { start: string; end: string }> = {
        morning: { start: '06:00', end: '12:00' },
        afternoon: { start: '12:00', end: '18:00' },
        evening: { start: '18:00', end: '23:59' }
      };

      // Check if appointment fits within any of the selected periods
      const isInSelectedPeriod = periods.some(period => {
        const range = periodRanges[period];
        if (!range) return false;
        return startTimeStr >= range.start && endTimeStr <= range.end;
      });

      if (!isInSelectedPeriod) {
        const availablePeriods = periods.map(p => {
          const labels: Record<string, string> = {
            morning: 'Morning (6am-12pm)',
            afternoon: 'Afternoon (12pm-6pm)',
            evening: 'Evening (6pm-12am)'
          };
          return labels[p] || p;
        }).join(', ');

        return {
          isAvailable: false,
          reason: `Worker is only available during: ${availablePeriods} (${workerSeasonalPeriod.season_name})`,
          availablePeriods: periods
        };
      }

      // Seasonal period allows this - skip regular schedule check
      return { isAvailable: true, availablePeriods: periods };
    }

    // SECOND: Fall back to regular schedule if no seasonal period
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