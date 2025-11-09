import { addDays, addWeeks, addMonths, isBefore, isAfter, format, parseISO } from "date-fns";

interface RecurrenceConfig {
  pattern: "daily" | "weekly" | "monthly";
  frequency: number;
  endDate: Date | null;
  daysOfWeek: string[];
}

interface AppointmentTemplate {
  start_time: Date;
  end_time: Date;
  title: string;
  description?: string;
  assigned_to?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function generateRecurringInstances(
  template: AppointmentTemplate,
  config: RecurrenceConfig,
  maxInstances: number = 52 // Limit to 1 year worth of instances
): AppointmentTemplate[] {
  const instances: AppointmentTemplate[] = [];
  let currentDate = new Date(template.start_time);
  const duration = template.end_time.getTime() - template.start_time.getTime();
  
  let instanceCount = 0;
  
  while (instanceCount < maxInstances) {
    // Check if we've passed the end date
    if (config.endDate && isAfter(currentDate, config.endDate)) {
      break;
    }

    // For weekly pattern, check if current day matches selected days
    if (config.pattern === "weekly") {
      const dayName = DAY_NAMES[currentDate.getDay()];
      if (config.daysOfWeek.length > 0 && !config.daysOfWeek.includes(dayName)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }
    }

    // Create instance
    const startTime = new Date(currentDate);
    const endTime = new Date(currentDate.getTime() + duration);
    
    instances.push({
      ...template,
      start_time: startTime,
      end_time: endTime,
    });

    instanceCount++;

    // Move to next occurrence
    switch (config.pattern) {
      case "daily":
        currentDate = addDays(currentDate, config.frequency);
        break;
      case "weekly":
        if (config.daysOfWeek.length > 0) {
          // Find next selected day
          let daysToAdd = 1;
          let nextDate = addDays(currentDate, daysToAdd);
          while (daysToAdd <= 7) {
            const nextDayName = DAY_NAMES[nextDate.getDay()];
            if (config.daysOfWeek.includes(nextDayName)) {
              currentDate = nextDate;
              break;
            }
            daysToAdd++;
            nextDate = addDays(currentDate, daysToAdd);
          }
          if (daysToAdd > 7) {
            currentDate = addWeeks(currentDate, config.frequency);
          }
        } else {
          currentDate = addWeeks(currentDate, config.frequency);
        }
        break;
      case "monthly":
        currentDate = addMonths(currentDate, config.frequency);
        break;
    }
  }

  return instances;
}

export function checkRecurringConflicts(
  instances: AppointmentTemplate[],
  existingAppointments: any[],
  workerId: string
): { instance: AppointmentTemplate; conflicts: any[] }[] {
  const conflictResults = instances.map(instance => {
    const conflicts = existingAppointments.filter(apt => {
      if (apt.assigned_to !== workerId) return false;
      
      const aptStart = parseISO(apt.start_time);
      const aptEnd = parseISO(apt.end_time);
      
      return (
        (instance.start_time >= aptStart && instance.start_time < aptEnd) ||
        (instance.end_time > aptStart && instance.end_time <= aptEnd) ||
        (instance.start_time <= aptStart && instance.end_time >= aptEnd)
      );
    });

    return { instance, conflicts };
  });

  return conflictResults.filter(result => result.conflicts.length > 0);
}
