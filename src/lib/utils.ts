import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

// Melbourne, Australia timezone
export const MELBOURNE_TZ = "Australia/Melbourne";

// Common format patterns for Melbourne timezone display
export const MELBOURNE_DATE_FORMAT = "MMM d, yyyy";
export const MELBOURNE_TIME_FORMAT = "h:mm a";
export const MELBOURNE_DATETIME_FORMAT = "MMM d, yyyy h:mm a";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get current date/time in Melbourne timezone
 */
export function getMelbourneNow(): Date {
  return toZonedTime(new Date(), MELBOURNE_TZ);
}

/**
 * Convert a date string or Date object to Melbourne timezone
 */
export function toMelbourneTime(date: string | Date): Date {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(dateObj, MELBOURNE_TZ);
}

/**
 * Format a date in Melbourne timezone with specified format string
 * Use this for displaying appointment/service order times to ensure
 * all users see the same "wall clock" time regardless of their location
 */
export function formatMelbourneTime(date: string | Date, formatStr: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(dateObj, MELBOURNE_TZ, formatStr);
}

/**
 * Format a number as currency in AUD format: $0,000.00
 * @param value - The numeric value to format
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "$0.00";
  }
  
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
