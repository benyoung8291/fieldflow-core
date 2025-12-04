import { useMemo } from "react";
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, getDay, format } from "date-fns";

interface Worker {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  skills?: any[];
  standard_work_hours?: number;
  employment_type?: string;
  isSubcontractor?: boolean;
  supplier_name?: string;
  worker_state?: string | null;
}

interface Schedule {
  worker_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Unavailability {
  worker_id: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}

export type AvailabilityStatus = "available" | "partial" | "unavailable";

export interface WorkerWithAvailability extends Worker {
  availabilityStatus: AvailabilityStatus;
  availabilityReason?: string;
}

export function useWorkerAvailabilitySort(
  workers: Worker[],
  subcontractors: Worker[],
  schedules: Schedule[],
  unavailability: Unavailability[],
  currentDate: Date
): WorkerWithAvailability[] {
  return useMemo(() => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const weekDays = [];
    
    // Generate days of the week
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      weekDays.push(day);
    }

    const getWorkerAvailability = (workerId: string): { status: AvailabilityStatus; reason?: string } => {
      // Get worker's schedule
      const workerSchedule = schedules.filter(s => s.worker_id === workerId && s.is_active);
      
      // Get worker's unavailability for this week
      const workerUnavail = unavailability.filter(u => {
        const unavailStart = parseISO(u.start_date);
        const unavailEnd = parseISO(u.end_date);
        
        // Check if unavailability overlaps with current week
        return (
          isWithinInterval(weekStart, { start: unavailStart, end: unavailEnd }) ||
          isWithinInterval(weekEnd, { start: unavailStart, end: unavailEnd }) ||
          (unavailStart >= weekStart && unavailStart <= weekEnd)
        );
      });

      // Check availability for each day of the week
      let availableDays = 0;
      let scheduledDays = 0;
      let unavailableDays = 0;
      let unavailableReason = "";

      for (const day of weekDays) {
        const dayOfWeek = getDay(day);
        const dateStr = format(day, "yyyy-MM-dd");
        
        // Check if worker has schedule for this day
        const hasSchedule = workerSchedule.some(s => s.day_of_week === dayOfWeek);
        
        if (hasSchedule) {
          scheduledDays++;
          
          // Check if worker is unavailable on this specific day
          const isUnavailable = workerUnavail.some(u => {
            const unavailStart = parseISO(u.start_date);
            const unavailEnd = parseISO(u.end_date);
            return isWithinInterval(day, { start: unavailStart, end: unavailEnd });
          });
          
          if (isUnavailable) {
            unavailableDays++;
            const unavail = workerUnavail.find(u => {
              const unavailStart = parseISO(u.start_date);
              const unavailEnd = parseISO(u.end_date);
              return isWithinInterval(day, { start: unavailStart, end: unavailEnd });
            });
            if (unavail?.reason && !unavailableReason) {
              unavailableReason = unavail.reason;
            }
          } else {
            availableDays++;
          }
        }
      }

      // Determine availability status
      if (scheduledDays === 0) {
        return { status: "unavailable", reason: "No schedule set" };
      }
      
      if (unavailableDays === scheduledDays) {
        return { status: "unavailable", reason: unavailableReason || "Unavailable all week" };
      }
      
      if (unavailableDays > 0) {
        return { 
          status: "partial", 
          reason: `Available ${availableDays}/${scheduledDays} days${unavailableReason ? ` (${unavailableReason})` : ""}` 
        };
      }
      
      return { status: "available" };
    };

    // Process internal workers
    const processedWorkers: WorkerWithAvailability[] = workers.map(worker => {
      const availability = getWorkerAvailability(worker.id);
      return {
        ...worker,
        availabilityStatus: availability.status,
        availabilityReason: availability.reason,
      };
    });

    // Process subcontractors (default to available since we may not have detailed schedules)
    const processedSubcontractors: WorkerWithAvailability[] = subcontractors.map(sub => ({
      ...sub,
      isSubcontractor: true,
      availabilityStatus: "available" as AvailabilityStatus,
    }));

    // Combine and sort: available first, then partial, then unavailable
    const statusOrder: Record<AvailabilityStatus, number> = {
      available: 0,
      partial: 1,
      unavailable: 2,
    };

    // Sort workers: internal workers first (sorted by availability), then subcontractors
    const sortedWorkers = [...processedWorkers].sort((a, b) => {
      const statusDiff = statusOrder[a.availabilityStatus] - statusOrder[b.availabilityStatus];
      if (statusDiff !== 0) return statusDiff;
      return (a.name || "").localeCompare(b.name || "");
    });

    const sortedSubcontractors = [...processedSubcontractors].sort((a, b) => 
      (a.name || "").localeCompare(b.name || "")
    );

    return [...sortedWorkers, ...sortedSubcontractors];
  }, [workers, subcontractors, schedules, unavailability, currentDate]);
}
