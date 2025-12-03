import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfDay, getDay, isWithinInterval, parseISO, differenceInMinutes } from "date-fns";
import type { WorkerUnavailability, DayAvailability, WorkerAvailability, GroupedWorkers } from "./useWorkerAvailabilityBoard";

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  worker_state: string | null;
  is_active: boolean;
}

interface WorkerSchedule {
  worker_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface SeasonalDate {
  id: string;
  seasonal_availability_id: string;
  date: string;
  periods: string[];
  worker_id: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  worker_ids: string[];
}

interface TVAvailabilityResponse {
  workers: Worker[];
  schedules: WorkerSchedule[];
  unavailability: WorkerUnavailability[];
  seasonalPeriods: any[];
  seasonalDates: SeasonalDate[];
  appointments: Appointment[];
}

// Period to hours mapping
const PERIOD_HOURS: Record<string, { start: number; end: number; hours: number }> = {
  morning: { start: 6, end: 12, hours: 6 },
  afternoon: { start: 12, end: 18, hours: 6 },
  evening: { start: 18, end: 22, hours: 4 },
  anytime: { start: 6, end: 22, hours: 16 },
};

function calculateHoursFromPeriods(periods: string[]): number {
  if (periods.includes("anytime")) return PERIOD_HOURS.anytime.hours;
  return periods.reduce((sum, p) => sum + (PERIOD_HOURS[p]?.hours || 0), 0);
}

function calculateHoursFromSchedule(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM - startH * 60 - startM) / 60;
}

export function useTVAvailabilityData() {
  const today = startOfDay(new Date());

  // Fetch all data from edge function
  const { data: apiData, isLoading, isError } = useQuery({
    queryKey: ["tv-availability-data"],
    queryFn: async (): Promise<TVAvailabilityResponse> => {
      const { data, error } = await supabase.functions.invoke("get-tv-availability-data");
      
      if (error) {
        console.error("Error fetching TV availability data:", error);
        throw error;
      }
      
      return data as TVAvailabilityResponse;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 60 * 1000, // Consider data stale after 1 minute
  });

  // Generate 60 days array
  const days = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const date = addDays(today, i);
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        dayOfWeek: getDay(date),
        dayNumber: format(date, "d"),
        dayName: format(date, "EEE"),
        month: format(date, "MMM"),
        isToday: i === 0,
        isWeekend: getDay(date) === 0 || getDay(date) === 6,
      };
    });
  }, [today]);

  // Process data into grouped workers
  const groupedWorkers = useMemo<GroupedWorkers>(() => {
    if (!apiData) {
      return { byState: {}, unavailableWorkers: [] };
    }

    const { workers, schedules, unavailability, seasonalDates, appointments } = apiData;
    const byState: Record<string, WorkerAvailability[]> = {};
    const unavailableWorkers: { worker: Worker; unavailability: WorkerUnavailability }[] = [];

    // Find workers completely unavailable for a significant period
    const fullyUnavailableWorkerIds = new Set<string>();
    unavailability.forEach((u) => {
      const start = parseISO(u.start_date);
      const end = parseISO(u.end_date);
      if (end.getTime() - start.getTime() > 7 * 24 * 60 * 60 * 1000) {
        const worker = workers.find((w) => w.id === u.worker_id);
        if (worker) {
          fullyUnavailableWorkerIds.add(u.worker_id);
          unavailableWorkers.push({ worker, unavailability: u });
        }
      }
    });

    // Create lookup for seasonal dates by worker and date
    const seasonalDateLookup: Record<string, SeasonalDate> = {};
    seasonalDates.forEach((sd) => {
      if (sd.worker_id) {
        seasonalDateLookup[`${sd.worker_id}-${sd.date}`] = sd;
      }
    });

    // Create lookup for appointments by date and worker
    const appointmentsByDateAndWorker: Record<string, Appointment[]> = {};
    appointments.forEach((apt) => {
      const aptDate = format(parseISO(apt.start_time), "yyyy-MM-dd");
      apt.worker_ids.forEach((workerId) => {
        const key = `${workerId}-${aptDate}`;
        if (!appointmentsByDateAndWorker[key]) {
          appointmentsByDateAndWorker[key] = [];
        }
        appointmentsByDateAndWorker[key].push(apt);
      });
    });

    workers.forEach((worker) => {
      if (fullyUnavailableWorkerIds.has(worker.id)) return;

      const workerSchedules = schedules.filter((s) => s.worker_id === worker.id);
      const workerUnavailability = unavailability.filter((u) => u.worker_id === worker.id);

      const scheduleByDay: Record<number, WorkerSchedule> = {};
      workerSchedules.forEach((s) => {
        scheduleByDay[s.day_of_week] = s;
      });

      const workerDays: DayAvailability[] = days.map((day) => {
        const schedule = scheduleByDay[day.dayOfWeek];
        const seasonalDate = seasonalDateLookup[`${worker.id}-${day.dateStr}`];
        const workerAppointments = appointmentsByDateAndWorker[`${worker.id}-${day.dateStr}`] || [];

        // Calculate assigned hours
        const assignedHours = workerAppointments.reduce((sum, apt) => {
          const start = parseISO(apt.start_time);
          const end = parseISO(apt.end_time);
          return sum + differenceInMinutes(end, start) / 60;
        }, 0);

        // Check unavailability first (highest priority)
        const unavailableEntry = workerUnavailability.find((u) => {
          const start = parseISO(u.start_date);
          const end = parseISO(u.end_date);
          return isWithinInterval(day.date, { start, end });
        });

        if (unavailableEntry) {
          return {
            date: day.date,
            dateStr: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            isAvailable: false,
            startTime: null,
            endTime: null,
            isUnavailable: true,
            unavailabilityReason: unavailableEntry.reason,
            availableHours: 0,
            assignedHours: 0,
            seasonalPeriods: [],
            isSeasonalOverride: false,
          };
        }

        // Check seasonal availability (second priority)
        if (seasonalDate && seasonalDate.periods.length > 0) {
          const availableHours = calculateHoursFromPeriods(seasonalDate.periods);
          const firstPeriod = seasonalDate.periods.includes("anytime") 
            ? "anytime" 
            : seasonalDate.periods[0];
          const periodInfo = PERIOD_HOURS[firstPeriod];
          const startTime = periodInfo ? `${String(periodInfo.start).padStart(2, "0")}:00:00` : null;
          const endTime = periodInfo ? `${String(periodInfo.end).padStart(2, "0")}:00:00` : null;

          return {
            date: day.date,
            dateStr: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            isAvailable: true,
            startTime,
            endTime,
            isUnavailable: false,
            unavailabilityReason: null,
            availableHours,
            assignedHours,
            seasonalPeriods: seasonalDate.periods,
            isSeasonalOverride: true,
          };
        }

        // Fall back to regular schedule
        if (schedule && schedule.is_active) {
          const availableHours = calculateHoursFromSchedule(schedule.start_time, schedule.end_time);
          return {
            date: day.date,
            dateStr: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            isAvailable: true,
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            isUnavailable: false,
            unavailabilityReason: null,
            availableHours,
            assignedHours,
            seasonalPeriods: [],
            isSeasonalOverride: false,
          };
        }

        return {
          date: day.date,
          dateStr: day.dateStr,
          dayOfWeek: day.dayOfWeek,
          isAvailable: false,
          startTime: null,
          endTime: null,
          isUnavailable: false,
          unavailabilityReason: null,
          availableHours: 0,
          assignedHours: 0,
          seasonalPeriods: [],
          isSeasonalOverride: false,
        };
      });

      // Filter out workers with no availability in the 60-day window
      const hasAnyAvailability = workerDays.some((d) => d.isAvailable || d.isSeasonalOverride);
      if (!hasAnyAvailability) return;

      const workerAvailability: WorkerAvailability = {
        worker,
        days: workerDays,
      };

      // Group by state
      const state = worker.worker_state || "Unknown";
      if (!byState[state]) {
        byState[state] = [];
      }
      byState[state].push(workerAvailability);
    });

    return { byState, unavailableWorkers };
  }, [apiData, days]);

  return {
    groupedWorkers,
    days,
    isLoading,
    isConnected: !isError,
  };
}
