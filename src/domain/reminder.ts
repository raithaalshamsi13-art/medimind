/**
 * Reminders and doses — REMIND and TRACK in SCAN → CHECK → CONFIRM → REMIND → TRACK.
 *
 * A REMINDER belongs to one medicine (and therefore one family member) and
 * says WHEN: a set of clock times, every day or on chosen weekdays, between
 * optional start and end dates. It carries the dose wording to show in the
 * notification ("500 mg"), copied from the medicine's recorded dosage — the
 * app never works a dose out.
 *
 * A DOSE is one occurrence of a reminder on one day: "Paracetamol at 08:00 on
 * 2026-09-14", with a status the user (or the missed-dose sweep) sets. Dose
 * rows are created lazily for the days the app looks at, never in advance
 * for the whole year, and a (reminder, scheduled time) pair is unique.
 *
 * SAFETY RULES (Phases 7 and 12)
 *   - an EXPIRED medicine cannot have a reminder; `suggestReminder` returns
 *     a `blocked` result and the screen refuses to save one
 *   - a missed dose is only ever *recorded*. Nothing here tells anyone to
 *     take a dose late, or two at once
 *   - suggested times come from `parseFrequency` on the recorded label
 *     wording; when the wording is not understood there is no suggestion,
 *     only an empty form the user fills in
 */

import { addDays, format, isAfter, isBefore, parseISO } from 'date-fns';
import { z } from 'zod';

import { parseFrequency } from './dosing';
import { expiryStatus } from './expiry';
import type { Medication } from './medication';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const REMINDER_FREQUENCIES = ['DAILY', 'SPECIFIC_DAYS'] as const;
export type ReminderFrequency = (typeof REMINDER_FREQUENCIES)[number];

/** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export type Reminder = {
  id: string;
  userId: string;
  memberId: string;
  medicationId: string;
  /** "HH:mm", ascending, unique. */
  times: string[];
  /** Shown in the notification, e.g. "500 mg". Null when not recorded. */
  doseLabel: string | null;
  frequency: ReminderFrequency;
  /** Only for SPECIFIC_DAYS. */
  days: Weekday[];
  /** "yyyy-MM-dd" or null = from today / no end. */
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
  /** OS notification identifiers, so they can be cancelled. */
  notificationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export const DOSE_STATUSES = ['UPCOMING', 'TAKEN', 'MISSED', 'SKIPPED'] as const;
export type DoseStatus = (typeof DOSE_STATUSES)[number];

export const DOSE_STATUS_LABELS: Record<DoseStatus, string> = {
  UPCOMING: 'Upcoming',
  TAKEN: 'Taken',
  MISSED: 'Missed',
  SKIPPED: 'Skipped',
};

export type Dose = {
  id: string;
  userId: string;
  memberId: string;
  medicationId: string;
  reminderId: string;
  /** Local wall-clock time, "yyyy-MM-dd'T'HH:mm". */
  scheduledAt: string;
  status: DoseStatus;
  /** When the user (or the sweep) set the status. */
  actedAt: string | null;
  /** One-off "you may have missed…" notification id, if scheduled. */
  followUpNotificationId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** How long after the scheduled time an unmarked dose counts as missed. */
export const MISSED_GRACE_MINUTES = 120;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function emptyToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const reminderInputSchema = z
  .object({
    times: z
      .array(z.string().regex(TIME_PATTERN, 'Please choose a valid time.'))
      .min(1, 'Please add at least one reminder time.')
      .max(12, 'Please use 12 reminder times or fewer.')
      .transform((times) => Array.from(new Set(times)).sort()),
    doseLabel: z.preprocess(
      emptyToNull,
      z.string().max(60, 'Please use 60 characters or fewer.').nullable(),
    ),
    frequency: z.enum(REMINDER_FREQUENCIES),
    days: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .transform((days) => Array.from(new Set(days)).sort() as Weekday[]),
    startDate: z.preprocess(
      emptyToNull,
      z.string().regex(ISO_DATE, 'Please choose the start date from the calendar.').nullable(),
    ),
    endDate: z.preprocess(
      emptyToNull,
      z.string().regex(ISO_DATE, 'Please choose the end date from the calendar.').nullable(),
    ),
    enabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === 'SPECIFIC_DAYS' && value.days.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'Please choose at least one day.' });
    }
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'The end date cannot be before the start date.',
      });
    }
  })
  .transform((value) => ({ ...value, days: value.frequency === 'DAILY' ? [] : value.days }));

export type ReminderInput = {
  times: string[];
  doseLabel: string | null;
  frequency: ReminderFrequency;
  days: Weekday[];
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
};

export type ReminderCreateInput = ReminderInput & { medicationId: string; memberId: string };

// ---------------------------------------------------------------------------
// Suggestion from the label
// ---------------------------------------------------------------------------

export type ReminderSuggestion =
  /** Times worked out from the recorded frequency; the user confirms them. */
  | { kind: 'suggested'; times: string[]; description: string; doseLabel: string | null }
  /** Label says "as needed" — no fixed times, but a reminder may still be set by hand. */
  | { kind: 'as-needed'; doseLabel: string | null }
  /** Frequency missing or not understood — empty form, no guess. */
  | { kind: 'none'; doseLabel: string | null }
  /** Expired: no normal reminder is allowed (Phase 7). */
  | { kind: 'blocked'; reason: string };

export function suggestReminder(
  medication: Pick<Medication, 'frequency' | 'dosage' | 'expirationDate'>,
  today: Date = new Date(),
): ReminderSuggestion {
  const expiry = expiryStatus(medication.expirationDate, today);
  if (expiry?.state === 'EXPIRED') {
    return {
      kind: 'blocked',
      reason:
        'This medicine has expired, so MediMind will not set a reminder for it. Ask a pharmacist about a replacement, then update the expiry date.',
    };
  }

  const schedule = parseFrequency(medication.frequency);
  if (!schedule) return { kind: 'none', doseLabel: medication.dosage };
  if (schedule.asNeeded) return { kind: 'as-needed', doseLabel: medication.dosage };
  return {
    kind: 'suggested',
    times: schedule.times,
    description: schedule.description,
    doseLabel: medication.dosage,
  };
}

// ---------------------------------------------------------------------------
// Occurrences
// ---------------------------------------------------------------------------

/** "yyyy-MM-dd" for a local date. */
export function localDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Does this reminder fire on the given local date? */
export function remindsOn(reminder: Pick<Reminder, 'frequency' | 'days' | 'startDate' | 'endDate' | 'enabled'>, date: Date): boolean {
  if (!reminder.enabled) return false;
  const key = localDateKey(date);
  if (reminder.startDate && key < reminder.startDate) return false;
  if (reminder.endDate && key > reminder.endDate) return false;
  if (reminder.frequency === 'SPECIFIC_DAYS') {
    return reminder.days.includes(date.getDay() as Weekday);
  }
  return true;
}

/** The scheduled local date-times ("yyyy-MM-dd'T'HH:mm") a reminder produces on one day. */
export function occurrencesOn(reminder: Reminder, date: Date): string[] {
  if (!remindsOn(reminder, date)) return [];
  const key = localDateKey(date);
  return reminder.times.map((time) => `${key}T${time}`);
}

/** Parse "yyyy-MM-dd'T'HH:mm" as local time. */
export function scheduledDate(scheduledAt: string): Date {
  return parseISO(scheduledAt);
}

/** True once the grace window after the scheduled time has passed. */
export function isPastGrace(scheduledAt: string, now: Date = new Date()): boolean {
  const due = scheduledDate(scheduledAt).getTime() + MISSED_GRACE_MINUTES * 60 * 1000;
  return now.getTime() > due;
}

/** True while a dose may sensibly be marked taken from the app: from 1 h before until grace end. */
export function isActionable(scheduledAt: string, now: Date = new Date()): boolean {
  const at = scheduledDate(scheduledAt).getTime();
  return now.getTime() >= at - 60 * 60 * 1000 && !isPastGrace(scheduledAt, now);
}

/** The local date keys from `from` to `to` inclusive. */
export function dateKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (!isAfter(cursor, end)) {
    keys.push(localDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

/** "8:00 AM and 8:00 PM" */
export function describeTimes(times: string[]): string {
  const pretty = times.map((time) => {
    const [h, m] = time.split(':').map(Number);
    const hour12 = ((h ?? 0) + 11) % 12 + 1;
    return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${(h ?? 0) < 12 ? 'AM' : 'PM'}`;
  });
  if (pretty.length <= 1) return pretty.join('');
  return `${pretty.slice(0, -1).join(', ')} and ${pretty[pretty.length - 1]}`;
}

/** "Every day" / "Mon, Wed and Fri" */
export function describeDays(reminder: Pick<Reminder, 'frequency' | 'days'>): string {
  if (reminder.frequency === 'DAILY' || reminder.days.length === 7) return 'Every day';
  const labels = reminder.days.map((day) => WEEKDAY_LABELS[day]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** True when `date` is strictly before today (local). */
export function isPastDay(key: string, today: Date = new Date()): boolean {
  return key < localDateKey(today);
}

export function isFutureDay(key: string, today: Date = new Date()): boolean {
  return key > localDateKey(today);
}

/** Convenience for tests and the sweep: has the scheduled moment passed? */
export function isDue(scheduledAt: string, now: Date = new Date()): boolean {
  return !isBefore(now, scheduledDate(scheduledAt));
}
