import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfDay, getDay, isWithinInterval, parseISO } from "date-fns";

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  employment_type: string | null;
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

export interface DayAvailability {
  date: Date;
  dateStr: string;
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  isUnavailable: boolean;
  unavailabilityReason: string | null;
}

export interface WorkerAvailability {
  worker: Worker;
  days: DayAvailability[];
}

export interface GroupedWorkers {
  fullTime: WorkerAvailability[];
  casual: WorkerAvailability[];
  unavailableWorkers: {
    worker: Worker;
    unavailability: WorkerUnavailability;
  }[];
}

export function useWorkerAvailabilityBoard() {
  const queryClient = useQueryClient();
  const today = startOfDay(new Date());
  const endDate = addDays(today, 29);

  // Fetch active workers
  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["tv-workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, employment_type, is_active")
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

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("tv-availability-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_schedule" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tv-worker-schedules"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_unavailability" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tv-worker-unavailability"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tv-workers"] });
        }
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

  // Calculate availability for each worker
  const groupedWorkers = useMemo<GroupedWorkers>(() => {
    const fullTime: WorkerAvailability[] = [];
    const casual: WorkerAvailability[] = [];
    const unavailableWorkers: { worker: Worker; unavailability: WorkerUnavailability }[] = [];

    // Find workers completely unavailable for a significant period
    const fullyUnavailableWorkerIds = new Set<string>();
    unavailability.forEach((u) => {
      const start = parseISO(u.start_date);
      const end = parseISO(u.end_date);
      // If unavailable for more than 7 days, show in unavailable section
      if (end.getTime() - start.getTime() > 7 * 24 * 60 * 60 * 1000) {
        const worker = workers.find((w) => w.id === u.worker_id);
        if (worker) {
          fullyUnavailableWorkerIds.add(u.worker_id);
          unavailableWorkers.push({ worker, unavailability: u });
        }
      }
    });

    workers.forEach((worker) => {
      // Skip workers in the fully unavailable section
      if (fullyUnavailableWorkerIds.has(worker.id)) return;

      const workerSchedules = schedules.filter((s) => s.worker_id === worker.id);
      const workerUnavailability = unavailability.filter((u) => u.worker_id === worker.id);

      // Create schedule lookup by day of week (0 = Sunday, 6 = Saturday)
      const scheduleByDay: Record<number, WorkerSchedule> = {};
      workerSchedules.forEach((s) => {
        scheduleByDay[s.day_of_week] = s;
      });

      const workerDays: DayAvailability[] = days.map((day) => {
        const schedule = scheduleByDay[day.dayOfWeek];
        
        // Check if worker is unavailable on this day
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
          };
        }

        if (schedule && schedule.is_active) {
          return {
            date: day.date,
            dateStr: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            isAvailable: true,
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            isUnavailable: false,
            unavailabilityReason: null,
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
        };
      });

      const workerAvailability: WorkerAvailability = {
        worker,
        days: workerDays,
      };

      if (worker.employment_type === "full_time") {
        fullTime.push(workerAvailability);
      } else {
        casual.push(workerAvailability);
      }
    });

    return { fullTime, casual, unavailableWorkers };
  }, [workers, schedules, unavailability, days]);

  return {
    groupedWorkers,
    days,
    isLoading: workersLoading || schedulesLoading || unavailabilityLoading,
    isConnected: true,
  };
}
