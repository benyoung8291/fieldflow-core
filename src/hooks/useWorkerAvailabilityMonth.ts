import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  getDay, 
  parseISO, 
  isWithinInterval,
  differenceInMinutes 
} from "date-fns";

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

interface WorkerUnavailability {
  worker_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
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

export interface WorkerMonthAvailability {
  worker: Worker;
  days: DayAvailability[];
}

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

export function useWorkerAvailabilityMonth(month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthKey = format(monthStart, "yyyy-MM");

  // Fetch active workers
  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["availability-calendar-workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, worker_state, is_active")
        .eq("is_active", true)
        .not("worker_state", "is", null)
        .order("first_name");

      if (error) throw error;
      return data as Worker[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch worker schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["availability-calendar-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_schedule")
        .select("worker_id, day_of_week, start_time, end_time, is_active")
        .eq("is_active", true);

      if (error) throw error;
      return data as WorkerSchedule[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch unavailability for the month
  const { data: unavailability = [], isLoading: unavailabilityLoading } = useQuery({
    queryKey: ["availability-calendar-unavailability", monthKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_unavailability")
        .select("worker_id, start_date, end_date, reason")
        .lte("start_date", format(monthEnd, "yyyy-MM-dd"))
        .gte("end_date", format(monthStart, "yyyy-MM-dd"));

      if (error) throw error;
      return data as WorkerUnavailability[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch seasonal availability dates
  const { data: seasonalDates = [], isLoading: seasonalLoading } = useQuery({
    queryKey: ["availability-calendar-seasonal", monthKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_seasonal_availability_dates")
        .select("id, seasonal_availability_id, date, periods, worker_seasonal_availability!inner(worker_id)")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));

      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        seasonal_availability_id: d.seasonal_availability_id,
        date: d.date,
        periods: d.periods || [],
        worker_id: d.worker_seasonal_availability?.worker_id,
      })) as SeasonalDate[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch appointments for the month
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["availability-calendar-appointments", monthKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, appointment_workers(worker_id)")
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString());

      if (error) throw error;
      return (data || []).map((apt: any) => ({
        id: apt.id,
        start_time: apt.start_time,
        end_time: apt.end_time,
        worker_ids: (apt.appointment_workers || []).map((aw: any) => aw.worker_id),
      })) as Appointment[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Generate month days
  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: monthStart, end: monthEnd }).map(date => ({
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      dayOfWeek: getDay(date),
    }));
  }, [monthStart, monthEnd]);

  // Calculate availability for each worker
  const workerAvailability = useMemo<WorkerMonthAvailability[]>(() => {
    // Create lookups
    const seasonalDateLookup: Record<string, SeasonalDate> = {};
    seasonalDates.forEach((sd) => {
      if (sd.worker_id) {
        seasonalDateLookup[`${sd.worker_id}-${sd.date}`] = sd;
      }
    });

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

    return workers.map((worker) => {
      const workerSchedules = schedules.filter((s) => s.worker_id === worker.id);
      const workerUnavailability = unavailability.filter((u) => u.worker_id === worker.id);

      const scheduleByDay: Record<number, WorkerSchedule> = {};
      workerSchedules.forEach((s) => {
        scheduleByDay[s.day_of_week] = s;
      });

      const days: DayAvailability[] = monthDays.map((day) => {
        const schedule = scheduleByDay[day.dayOfWeek];
        const seasonalDate = seasonalDateLookup[`${worker.id}-${day.dateStr}`];
        const workerAppointments = appointmentsByDateAndWorker[`${worker.id}-${day.dateStr}`] || [];

        // Calculate assigned hours
        const assignedHours = workerAppointments.reduce((sum, apt) => {
          const start = parseISO(apt.start_time);
          const end = parseISO(apt.end_time);
          return sum + differenceInMinutes(end, start) / 60;
        }, 0);

        // Check unavailability first
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

        // Check seasonal availability
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

      return { worker, days };
    });
  }, [workers, schedules, unavailability, seasonalDates, appointments, monthDays]);

  return {
    workerAvailability,
    isLoading: workersLoading || schedulesLoading || unavailabilityLoading || seasonalLoading || appointmentsLoading,
  };
}
