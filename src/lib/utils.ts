import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toZonedTime } from "date-fns-tz";

// Melbourne, Australia timezone
export const MELBOURNE_TZ = "Australia/Melbourne";

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
