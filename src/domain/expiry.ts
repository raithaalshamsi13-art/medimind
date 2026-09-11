/**
 * Expiry-date status, computed from the date alone.
 *
 * This is the one place that decides whether a date counts as expired or
 * "expiring soon". The form uses it for live feedback while the user picks a
 * date, and the safety engine (Milestone 4) will use the same function so the
 * two can never disagree.
 *
 * It looks only at calendar days, never at the time of day: a medicine that
 * expires "30 Apr" is fine on 30 Apr and expired on 1 May.
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Days before expiry at which a medicine starts being flagged. */
export const EXPIRY_WARNING_DAYS = 30;

export type ExpiryState = 'EXPIRED' | 'EXPIRING_SOON' | 'OK';

export type ExpiryStatus = {
  state: ExpiryState;
  /** Days until expiry. Negative when already expired. */
  daysUntil: number;
  /** Plain-language sentence, e.g. "Expired 3 days ago". */
  label: string;
};

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}

/**
 * Returns null for a blank or malformed date, so callers show nothing rather
 * than a misleading "OK".
 */
export function expiryStatus(isoDate: string | null, today: Date = new Date()): ExpiryStatus | null {
  if (!isoDate || !isValidIsoDate(isoDate)) return null;

  const daysUntil = differenceInCalendarDays(parseISO(isoDate), today);

  if (daysUntil < 0) {
    const ago = -daysUntil;
    return {
      state: 'EXPIRED',
      daysUntil,
      label: ago === 1 ? 'Expired yesterday' : `Expired ${ago} days ago`,
    };
  }
  if (daysUntil === 0) {
    return { state: 'EXPIRING_SOON', daysUntil, label: 'Expires today' };
  }
  if (daysUntil <= EXPIRY_WARNING_DAYS) {
    return {
      state: 'EXPIRING_SOON',
      daysUntil,
      label: daysUntil === 1 ? 'Expires tomorrow' : `Expires in ${daysUntil} days`,
    };
  }
  return { state: 'OK', daysUntil, label: 'In date' };
}
