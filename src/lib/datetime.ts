/**
 * Date and time helpers.
 *
 * Everything MediMind persists uses ISO-8601 strings, because SQLite has no
 * native date type and ISO strings sort correctly as text. Conversion to a
 * Date object happens at the edges only.
 */

import { format, parseISO } from 'date-fns';

/** Current instant as an ISO-8601 string, e.g. "2026-09-03T14:05:00.000Z". */
export function isoNow(): string {
  return new Date().toISOString();
}

/** Today as "yyyy-MM-dd" — the format used for expiry dates. */
export function isoToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Time-of-day greeting for the dashboard. */
export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Thursday, 3 September" — used as the dashboard subheading. */
export function formatFullDate(date: Date = new Date()): string {
  return format(date, 'EEEE, d MMMM');
}

/**
 * "30 Apr 2027" from a stored "2027-04-30".
 * Returns the raw value unchanged if it cannot be parsed, so a bad date is
 * shown honestly rather than as "Invalid Date".
 */
export function formatIsoDate(value: string): string {
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'd MMM yyyy');
  } catch {
    return value;
  }
}

/** "8:00 PM" from a "20:00" reminder time or a Date. */
export function formatClockTime(value: Date | string): string {
  if (typeof value === 'string') {
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    return format(date, 'h:mm a');
  }
  return format(value, 'h:mm a');
}
