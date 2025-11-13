import { useMemo } from "react";
import { differenceInHours, startOfWeek, endOfWeek } from "date-fns";

interface Worker {
  id: string;
  standard_work_hours?: number;
  employment_type?: string;
}

interface Appointment {
  id: string;
  assigned_to: string | null;
  start_time: string;
  end_time: string;
  status: string;
  appointment_workers?: Array<{ worker_id: string }>;
}

export function useWorkerUtilization(
  workers: Worker[],
  appointments: Appointment[],
  currentDate: Date
) {
  return useMemo(() => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);

    return workers.map(worker => {
      // Get standard work hours (default to 40 for full-time, 0 for others)
      const standardHours = worker.standard_work_hours || 
        (worker.employment_type === 'full_time' ? 40 : 0);

      // Calculate scheduled hours for this week
      const scheduledHours = appointments
        .filter(apt => {
          const aptStart = new Date(apt.start_time);
          const aptEnd = new Date(apt.end_time);
          
          // Check if appointment is within the week and not cancelled
          if (apt.status === 'cancelled') return false;
          if (aptStart < weekStart || aptStart > weekEnd) return false;
          
          // Check if worker is assigned (either primary or in appointment_workers)
          const isPrimary = apt.assigned_to === worker.id;
          const isAssigned = apt.appointment_workers?.some(aw => aw.worker_id === worker.id);
          
          return isPrimary || isAssigned;
        })
        .reduce((total, apt) => {
          const hours = differenceInHours(
            new Date(apt.end_time),
            new Date(apt.start_time)
          );
          return total + hours;
        }, 0);

      // Calculate utilization percentage
      const utilization = standardHours > 0 
        ? Math.round((scheduledHours / standardHours) * 100)
        : 0;

      // Determine color based on utilization
      const getUtilizationColor = () => {
        if (utilization === 0) return 'text-muted-foreground';
        if (utilization < 70) return 'text-success';
        if (utilization < 90) return 'text-warning';
        if (utilization < 100) return 'text-info';
        return 'text-destructive';
      };

      const getUtilizationBgColor = () => {
        if (utilization === 0) return 'bg-muted';
        if (utilization < 70) return 'bg-success';
        if (utilization < 90) return 'bg-warning';
        if (utilization < 100) return 'bg-info';
        return 'bg-destructive';
      };

      return {
        workerId: worker.id,
        scheduledHours,
        standardHours,
        utilization,
        utilizationColor: getUtilizationColor(),
        utilizationBgColor: getUtilizationBgColor(),
        isOverbooked: utilization > 100,
        isUnderUtilized: utilization < 70 && standardHours > 0,
      };
    });
  }, [workers, appointments, currentDate]);
}
