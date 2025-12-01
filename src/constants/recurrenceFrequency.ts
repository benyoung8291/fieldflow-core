/**
 * Shared constants for recurrence frequency
 * These values MUST match the database enum: recurrence_frequency
 */

export const RECURRENCE_FREQUENCY_VALUES = {
  ONE_TIME: "one_time",
  DAILY: "daily",
  WEEKLY: "weekly",
  BI_WEEKLY: "bi_weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  SEMI_ANNUALLY: "semi_annually",
  ANNUALLY: "annually",
} as const;

export const RECURRENCE_FREQUENCY_OPTIONS = [
  { value: RECURRENCE_FREQUENCY_VALUES.ONE_TIME, label: "One Time" },
  { value: RECURRENCE_FREQUENCY_VALUES.DAILY, label: "Daily" },
  { value: RECURRENCE_FREQUENCY_VALUES.WEEKLY, label: "Weekly" },
  { value: RECURRENCE_FREQUENCY_VALUES.BI_WEEKLY, label: "Fortnightly" },
  { value: RECURRENCE_FREQUENCY_VALUES.MONTHLY, label: "Monthly" },
  { value: RECURRENCE_FREQUENCY_VALUES.QUARTERLY, label: "Quarterly" },
  { value: RECURRENCE_FREQUENCY_VALUES.SEMI_ANNUALLY, label: "6 Monthly" },
  { value: RECURRENCE_FREQUENCY_VALUES.ANNUALLY, label: "Annually" },
];

export type RecurrenceFrequency = typeof RECURRENCE_FREQUENCY_VALUES[keyof typeof RECURRENCE_FREQUENCY_VALUES];
