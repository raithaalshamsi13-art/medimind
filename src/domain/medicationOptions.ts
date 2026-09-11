/**
 * Structured choices for the medicine form, and how they map to the plain
 * text fields that are actually stored.
 *
 * WHY TEXT IS STILL WHAT GETS STORED
 * `dosage`, `frequency` and `instructions` stay free-text columns. Labels
 * are written in words, the scanner (Milestone 4) produces words, the
 * assistant reads words back, and `parseFrequency` understands words. The
 * chips in the form are a faster, less error-prone way to *produce* those
 * words — not a second data model. Every preset here therefore composes to
 * text that `parseFrequency` already accepts, and every stored string can be
 * decomposed back into a preset when the user comes to edit it.
 *
 * Anything that does not fit a preset is kept verbatim as "custom" text. The
 * form never silently rewrites what the user (or the label) said.
 */

// ---------------------------------------------------------------------------
// Dosage: amount + unit  →  "500 mg"
// ---------------------------------------------------------------------------

export const DOSAGE_UNITS = ['mg', 'g', 'mcg', 'ml', 'IU', 'tablet', 'capsule', 'puff', 'drop'] as const;
export type DosageUnit = (typeof DOSAGE_UNITS)[number];

/** Units that read as "1 tablet" / "2 tablets" rather than "500 mg". */
const COUNT_UNITS: ReadonlySet<DosageUnit> = new Set(['tablet', 'capsule', 'puff', 'drop']);

export function dosageUnitLabel(unit: DosageUnit): string {
  return COUNT_UNITS.has(unit) ? `${unit}(s)` : unit;
}

/** A number the form accepts: "1", "0.5", "2.5", "1/2". */
const AMOUNT_PATTERN = /^(\d+(?:[.,]\d+)?|\d+\/\d+)$/;

export function isValidDoseAmount(amount: string): boolean {
  return AMOUNT_PATTERN.test(amount.trim());
}

/**
 * "500" + "mg" → "500 mg"; "2" + "tablet" → "2 tablets"; "1" + "tablet" → "1 tablet".
 * Returns null when the amount is blank, so an unfilled row stores nothing.
 */
export function composeDosage(amount: string, unit: DosageUnit): string | null {
  const trimmed = amount.trim().replace(',', '.');
  if (trimmed.length === 0) return null;

  if (COUNT_UNITS.has(unit)) {
    const plural = trimmed !== '1' && trimmed !== '1/1';
    return `${trimmed} ${unit}${plural ? 's' : ''}`;
  }
  return `${trimmed} ${unit}`;
}

export type ParsedDosage = { amount: string; unit: DosageUnit };

/**
 * "500 mg" → { amount: "500", unit: "mg" }; "2 tablets" → { "2", "tablet" }.
 * Null when the text is not exactly one amount followed by one known unit —
 * in which case the form shows it as custom text instead of guessing.
 */
export function parseDosage(text: string | null): ParsedDosage | null {
  if (!text) return null;
  const match = text.trim().match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*([a-zA-Z]+)$/);
  if (!match) return null;

  const amount = match[1].replace(',', '.');
  const rawUnit = match[2];
  const lower = rawUnit.toLowerCase();

  for (const unit of DOSAGE_UNITS) {
    const u = unit.toLowerCase();
    if (lower === u || (COUNT_UNITS.has(unit) && lower === `${u}s`)) {
      return { amount, unit };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Frequency presets  →  wording that `parseFrequency` understands
// ---------------------------------------------------------------------------

export const FREQUENCY_PRESETS = [
  'ONCE_DAILY',
  'TWICE_DAILY',
  'THREE_TIMES_DAILY',
  'FOUR_TIMES_DAILY',
  'EVERY_HOURS',
  'AS_NEEDED',
  'OTHER',
] as const;
export type FrequencyPreset = (typeof FREQUENCY_PRESETS)[number];

export const FREQUENCY_PRESET_LABELS: Record<FrequencyPreset, string> = {
  ONCE_DAILY: 'Once a day',
  TWICE_DAILY: 'Twice a day',
  THREE_TIMES_DAILY: '3 times a day',
  FOUR_TIMES_DAILY: '4 times a day',
  EVERY_HOURS: 'Every … hours',
  AS_NEEDED: 'Only when needed',
  OTHER: 'Something else',
};

/** The exact stored text for each fixed preset. */
const FREQUENCY_TEXT: Record<Exclude<FrequencyPreset, 'EVERY_HOURS' | 'OTHER'>, string> = {
  ONCE_DAILY: 'Once daily',
  TWICE_DAILY: 'Twice daily',
  THREE_TIMES_DAILY: '3 times daily',
  FOUR_TIMES_DAILY: '4 times daily',
  AS_NEEDED: 'As needed',
};

export type FrequencyChoice = {
  preset: FrequencyPreset | null;
  /** Used by EVERY_HOURS, e.g. "8". */
  hours: string;
  /** Used by OTHER: the user's own wording. */
  custom: string;
};

export const EMPTY_FREQUENCY_CHOICE: FrequencyChoice = { preset: null, hours: '', custom: '' };

/** Whole hours from 1 to 24 — anything else is not a schedule. */
export function isValidEveryHours(hours: string): boolean {
  const n = Number(hours.trim());
  return Number.isInteger(n) && n >= 1 && n <= 24;
}

/**
 * Turn a choice into the stored text. Null when nothing usable was chosen
 * (no preset; EVERY_HOURS without a number; OTHER with blank text).
 */
export function composeFrequency(choice: FrequencyChoice): string | null {
  switch (choice.preset) {
    case null:
      return null;
    case 'EVERY_HOURS':
      return isValidEveryHours(choice.hours) ? `Every ${Number(choice.hours)} hours` : null;
    case 'OTHER': {
      const text = choice.custom.trim();
      return text.length === 0 ? null : text;
    }
    default:
      return FREQUENCY_TEXT[choice.preset];
  }
}

/**
 * Recognise stored text as a preset so the edit form can pre-select the same
 * chip. Anything unrecognised becomes OTHER with the text kept verbatim.
 */
export function parseFrequencyChoice(text: string | null): FrequencyChoice {
  if (!text || text.trim().length === 0) return EMPTY_FREQUENCY_CHOICE;
  const t = text.trim().toLowerCase();

  for (const [preset, stored] of Object.entries(FREQUENCY_TEXT)) {
    if (t === stored.toLowerCase()) {
      return { preset: preset as FrequencyPreset, hours: '', custom: '' };
    }
  }

  const every = t.match(/^every (\d{1,2}) hours?$/);
  if (every && isValidEveryHours(every[1])) {
    return { preset: 'EVERY_HOURS', hours: every[1], custom: '' };
  }

  return { preset: 'OTHER', hours: '', custom: text.trim() };
}

// ---------------------------------------------------------------------------
// Instructions: common phrases as chips + free text  →  one sentence list
// ---------------------------------------------------------------------------

export const INSTRUCTION_OPTIONS = [
  'With food',
  'Before food',
  'After food',
  'With a full glass of water',
  'In the morning',
  'At bedtime',
  'Do not crush or chew',
  'Keep in the fridge',
] as const;
export type InstructionOption = (typeof INSTRUCTION_OPTIONS)[number];

const INSTRUCTION_SEPARATOR = '. ';

/**
 * ["With food", "At bedtime"] + "Avoid grapefruit" → "With food. At bedtime. Avoid grapefruit"
 * Order follows the option list, not click order, so the text is stable.
 */
export function composeInstructions(selected: readonly string[], extra: string): string | null {
  const chosen = INSTRUCTION_OPTIONS.filter((option) => selected.includes(option));
  const free = extra.trim();
  const parts: string[] = [...chosen];
  if (free.length > 0) parts.push(free);
  return parts.length === 0 ? null : parts.join(INSTRUCTION_SEPARATOR);
}

export type ParsedInstructions = { selected: InstructionOption[]; extra: string };

/**
 * Inverse of composeInstructions. Leading parts that exactly match an option
 * become chips; whatever is left is kept as free text — including any text
 * from a scanned label that never came from chips.
 */
export function parseInstructions(text: string | null): ParsedInstructions {
  if (!text || text.trim().length === 0) return { selected: [], extra: '' };

  const parts = text
    .split(/\.\s+|\.$/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const selected: InstructionOption[] = [];
  const rest: string[] = [];
  for (const part of parts) {
    const option = INSTRUCTION_OPTIONS.find((o) => o.toLowerCase() === part.toLowerCase());
    if (option && !selected.includes(option)) selected.push(option);
    else rest.push(part);
  }

  return { selected, extra: rest.join(INSTRUCTION_SEPARATOR) };
}
