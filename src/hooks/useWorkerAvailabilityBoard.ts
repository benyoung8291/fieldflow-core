import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfDay, getDay, isWithinInterval, parseISO, differenceInMinutes } from "date-fns";

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

export interface WorkerUnavailability {
  worker_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  notes: string | null;
}

interface SeasonalAvailability {
  id: string;
  worker_id: string;
  start_date: string;
  end_date: string;
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

export interface DayAvailability {
  date: Date;
  dateStr: string;
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  isUnavailable: boolean;
  unavailabilityReason: string | null;
  availableHours: number;
  assignedHours: number;
  seasonalPeriods: string[];
  isSeasonalOverride: boolean;
}

export interface WorkerAvailability {
  worker: Worker;
  days: DayAvailability[];
}

export interface GroupedWorkers {
  byState: Record<string, WorkerAvailability[]>;
  unavailableWorkers: {
    worker: Worker;
    unavailability: WorkerUnavailability;
  }[];
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

export function useWorkerAvailabilityBoard() {
  const queryClient = useQueryClient();
  const today = startOfDay(new Date());
  const endDate = addDays(today, 29);

  // Fetch active workers with worker_state
  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["tv-workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, worker_state, is_active")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data as Worker[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch worker schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["tv-worker-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_schedule")
        .select("worker_id, day_of_week, start_time, end_time, is_active")
        .eq("is_active", true);

      if (error) throw error;
      return data as WorkerSchedule[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch unavailability for next 30 days
  const { data: unavailability = [], isLoading: unavailabilityLoading } = useQuery({
    queryKey: ["tv-worker-unavailability", format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_unavailability")
        .select("worker_id, start_date, end_date, reason, notes")
        .lte("start_date", format(endDate, "yyyy-MM-dd"))
        .gte("end_date", format(today, "yyyy-MM-dd"));

      if (error) throw error;
      return data as WorkerUnavailability[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch seasonal availability periods
  const { data: seasonalPeriods = [], isLoading: seasonalLoading } = useQuery({
    queryKey: ["tv-seasonal-availability", format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_seasonal_availability")
        .select("id, worker_id, start_date, end_date")
        .lte("start_date", format(endDate, "yyyy-MM-dd"))
        .gte("end_date", format(today, "yyyy-MM-dd"));

      if (error) throw error;
      return data as SeasonalAvailability[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch seasonal availability dates
  const { data: seasonalDates = [], isLoading: seasonalDatesLoading } = useQuery({
    queryKey: ["tv-seasonal-dates", format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_seasonal_availability_dates")
        .select("id, seasonal_availability_id, date, periods, worker_seasonal_availability!inner(worker_id)")
        .gte("date", format(today, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        seasonal_availability_id: d.seasonal_availability_id,
        date: d.date,
        periods: d.periods || [],
        worker_id: d.worker_seasonal_availability?.worker_id,
      })) as SeasonalDate[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch appointments for next 30 days
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["tv-appointments", format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, appointment_workers(worker_id)")
        .gte("start_time", today.toISOString())
        .lte("start_time", endDate.toISOString());

      if (error) throw error;
      return (data || []).map((apt: any) => ({
        id: apt.id,
        start_time: apt.start_time,
        end_time: apt.end_time,
        worker_ids: (apt.appointment_workers || []).map((aw: any) => aw.worker_id),
      })) as Appointment[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("tv-availability-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_schedule" },
        () => queryClient.invalidateQueries({ queryKey: ["tv-worker-schedules"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_unavailability" },
        () => queryClient.invalidateQueries({ queryKey: ["tv-worker-unavailability"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => queryClient.invalidateQueries({ queryKey: ["tv-workers"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_seasonal_availability" },
        () => queryClient.invalidateQueries({ queryKey: ["tv-seasonal-availability"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_seasonal_availability_dates" },
        () => queryClient.invalidateQueries({ queryKey: ["tv-seasonal-dates"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => queryClient.invalidateQueries({ queryKey: ["tv-appointments"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_workers" },
        () => queryClient.invalidateQueries({ queryKey: ["tv-appointments"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Generate 30 days array
  const days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
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

  // Calculate availability for each worker grouped by state
  const groupedWorkers = useMemo<GroupedWorkers>(() => {
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
          // Get start time from first period
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

      // Filter out workers with no availability in the 30-day window
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
  }, [workers, schedules, unavailability, seasonalDates, appointments, days]);

  return {
    groupedWorkers,
    days,
    isLoading: workersLoading || schedulesLoading || unavailabilityLoading || seasonalLoading || seasonalDatesLoading || appointmentsLoading,
    isConnected: true,
  };
}
