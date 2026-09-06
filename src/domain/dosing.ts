/**
 * Dose scheduling derived from the label — nothing else.
 *
 * WHAT THIS DOES
 * Turns the frequency text a user recorded from a medicine label ("twice
 * daily", "every 8 hours", "at bedtime", "as needed") into concrete times of
 * day, and works out which dose comes next. That lets the assistant answer
 * "what is my next dose?" and lets Milestone 5 pre-fill reminder times.
 *
 * WHAT THIS MUST NEVER DO
 * It never decides *how much* to take. The amount comes from `dosage` as the
 * user recorded it, or it is reported as "not recorded". If the frequency text
 * cannot be understood, this returns `null` and the caller says so — it does
 * not fall back to a "sensible default" schedule, because a made-up schedule
 * for a real medicine is exactly the kind of invention MediMind forbids.
 *
 * The clock times themselves (08:00, 14:00, 20:00, ...) are conventional
 * evenly-spaced defaults for "N times a day". They are a starting suggestion
 * the user confirms, never an instruction.
 */

import { addDays, parseISO } from 'date-fns';

export type DoseSchedule = {
  /** Local clock times, "HH:mm", ascending. Empty when `asNeeded`. */
  times: string[];
  /** Normalised wording, e.g. "twice daily". */
  description: string;
  /** "As needed" / PRN — no fixed times; the label governs. */
  asNeeded: boolean;
};

export type NextDose = {
  /** Absolute time of the next scheduled dose. */
  at: Date;
  /** "HH:mm" that produced it. */
  time: string;
  /** True when the next dose is on the following calendar day. */
  isTomorrow: boolean;
  /** True when now is within ±30 minutes of the scheduled time. */
  isDueNow: boolean;
};

const DEFAULT_TIMES: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  6: ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'],
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  once: 1,
  two: 2,
  twice: 2,
  three: 3,
  thrice: 3,
  four: 4,
  five: 5,
  six: 6,
};

function schedule(times: string[], description: string): DoseSchedule {
  return { times: [...times].sort(), description, asNeeded: false };
}

function timesFromCount(count: number, description: string): DoseSchedule | null {
  const preset = DEFAULT_TIMES[count];
  if (preset) return schedule(preset, description);
  if (count < 1 || count > 12) return null;

  // Evenly spread across the waking day, 08:00–20:00.
  const start = 8;
  const span = 12;
  const times = Array.from({ length: count }, (_, i) => {
    const hour = count === 1 ? start : start + (span * i) / (count - 1);
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
  return schedule(times, description);
}

/**
 * Parse recorded frequency text into a schedule.
 * Returns `null` when the wording is not understood — callers must say so.
 */
export function parseFrequency(text: string | null | undefined): DoseSchedule | null {
  if (!text) return null;
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (t.length === 0) return null;

  // As needed / PRN — no fixed times.
  if (/\b(as needed|when needed|when required|if needed|as required|prn)\b/.test(t)) {
    return { times: [], description: 'as needed', asNeeded: true };
  }

  // Specific parts of the day ("every morning", "morning and evening",
  // "at bedtime", "with lunch"). Skipped when the wording is hour-based, e.g.
  // "every 8 hours starting in the morning", which the next branch handles.
  const morning = /\b(morning|breakfast|am\b)/.test(t);
  const midday = /\b(midday|noon|lunch)/.test(t);
  const evening = /\b(evening|dinner|supper|tea ?time)/.test(t);
  const night = /\b(night|bedtime|bed time|before bed|at bed)/.test(t);
  const partTimes = [
    morning ? '08:00' : null,
    midday ? '13:00' : null,
    evening ? '18:00' : null,
    night ? '21:00' : null,
  ].filter((v): v is string => v !== null);
  if (partTimes.length > 0 && !/\b(times|hourly|hours?|hrs?)\b/.test(t)) {
    const words = [
      morning ? 'morning' : null,
      midday ? 'midday' : null,
      evening ? 'evening' : null,
      night ? 'night' : null,
    ].filter(Boolean);
    return schedule(partTimes, `every ${words.join(' and ')}`);
  }

  // Every N hours.
  const everyHours = t.match(/\bevery (\d+|[a-z]+) ?(hours?|hrs?|h)\b/);
  if (everyHours) {
    const raw = everyHours[1];
    const n = /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw];
    if (n && n > 0 && n <= 24 && 24 % n === 0) {
      const count = 24 / n;
      const times = Array.from({ length: count }, (_, i) => {
        const hour = (8 + i * n) % 24;
        return `${String(hour).padStart(2, '0')}:00`;
      });
      return schedule(times, `every ${n} hours`);
    }
    return null;
  }

  // "N times a day", "N times daily", "Nx daily", "twice daily", "once a day",
  // "daily", "every day".
  const numeric = t.match(/\b(\d+)\s*(?:x|times?)\s*(?:a|per|each|every)?\s*(?:day|daily)\b/);
  if (numeric) {
    const n = Number(numeric[1]);
    return timesFromCount(n, n === 1 ? 'once daily' : `${n} times daily`);
  }
  const worded = t.match(
    /\b(once|twice|thrice|one|two|three|four|five|six)\s*(?:times?)?\s*(?:a|per|each|every)?\s*(?:day|daily)\b/,
  );
  if (worded) {
    const n = WORD_NUMBERS[worded[1]];
    const desc = n === 1 ? 'once daily' : n === 2 ? 'twice daily' : `${n} times daily`;
    return timesFromCount(n, desc);
  }
  if (/\b(daily|every day|each day|once daily|od)\b/.test(t)) {
    return timesFromCount(1, 'once daily');
  }
  if (/\b(bid|b\.i\.d)\b/.test(t)) return timesFromCount(2, 'twice daily');
  if (/\b(tid|t\.i\.d)\b/.test(t)) return timesFromCount(3, '3 times daily');
  if (/\b(qid|q\.i\.d)\b/.test(t)) return timesFromCount(4, '4 times daily');

  return null;
}

function todayAt(time: string, reference: Date): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(reference);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/**
 * The next scheduled dose at or after `now`. Returns `null` for "as needed"
 * schedules, which have no fixed times.
 */
export function nextDose(sched: DoseSchedule, now: Date = new Date()): NextDose | null {
  if (sched.asNeeded || sched.times.length === 0) return null;

  const dueWindowMs = 30 * 60 * 1000;

  // A dose within the last 30 minutes still counts as "now".
  for (const time of sched.times) {
    const at = todayAt(time, now);
    if (Math.abs(at.getTime() - now.getTime()) <= dueWindowMs) {
      return { at, time, isTomorrow: false, isDueNow: true };
    }
  }
  for (const time of sched.times) {
    const at = todayAt(time, now);
    if (at.getTime() > now.getTime()) {
      return { at, time, isTomorrow: false, isDueNow: false };
    }
  }
  const first = sched.times[0];
  const at = todayAt(first, addDays(now, 1));
  return { at, time: first, isTomorrow: true, isDueNow: false };
}

/** Parse a stored ISO date-time or fall back to now. Used by the store. */
export function referenceTime(iso?: string | null): Date {
  if (!iso) return new Date();
  const parsed = parseISO(iso);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
