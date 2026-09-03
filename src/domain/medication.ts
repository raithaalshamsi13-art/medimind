/**
 * The Medication entity — the centre of the data model.
 *
 * Note how many fields are nullable. That is deliberate and is the technical
 * expression of the project's medical-safety rule: if the AI or the user could
 * not determine the dosage, the value is `null` and the UI says "could not be
 * determined". There is no default, no guess and no placeholder.
 */

import { z } from 'zod';

export const SAFETY_STATUSES = [
  /** Expiry date is in the future and the key fields are present. */
  'SAFE',
  /** Expires within the warning window (30 days). */
  'EXPIRING_SOON',
  /** Expiry date has passed. No normal reminder is created. */
  'EXPIRED',
  /** Something important is missing or unclear — the user must confirm it. */
  'NEEDS_REVIEW',
  /** Not yet evaluated. */
  'UNKNOWN',
] as const;

export type SafetyStatus = (typeof SAFETY_STATUSES)[number];

export const MEDICATION_SOURCES = ['SCAN', 'MANUAL'] as const;
export type MedicationSource = (typeof MEDICATION_SOURCES)[number];

export type Medication = {
  id: string;
  userId: string;
  name: string;
  /** e.g. "500 mg". Null when it could not be determined. */
  dosage: string | null;
  /** Free text copied from the label, e.g. "Take with food". */
  instructions: string | null;
  /** ISO "yyyy-MM-dd". Null when the label had no readable expiry date. */
  expirationDate: string | null;
  /** Human-readable frequency from the label, e.g. "Once daily". */
  frequency: string | null;
  safetyStatus: SafetyStatus;
  source: MedicationSource;
  /** OCR/AI confidence 0-1. Null for manually entered medicines. */
  scanConfidence: number | null;
  notes: string | null;
  /** Local file URI of the captured label photo. */
  imageUri: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Human-readable labels for every safety status.
 *
 * ACCESSIBILITY (Phase 16): these exist so that a status is always spelled out
 * in words. A colour or an icon is never the only signal.
 */
export const SAFETY_STATUS_LABELS: Record<SafetyStatus, string> = {
  SAFE: 'Safe to use',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
  NEEDS_REVIEW: 'Needs your review',
  UNKNOWN: 'Not checked yet',
};

/** Shown when a field could not be read — never leave a value blank. */
export const UNKNOWN_FIELD_TEXT = 'Could not be determined';

// ---------------------------------------------------------------------------
// Validation
//
// PHASE 8 RULE: "do not allow obviously invalid data". These schemas are the
// single definition of a valid medicine, shared by the manual entry form, the
// edit form and (from Milestone 4) the parser that validates AI output.
// ---------------------------------------------------------------------------

/**
 * Trim a string field, and treat "" as "not provided" rather than as an empty
 * value. This is what keeps `null` meaning "could not be determined".
 */
function emptyToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalText(max: number, label: string) {
  return z.preprocess(
    emptyToNull,
    z
      .string()
      .max(max, `${label} is too long — please use ${max} characters or fewer.`)
      .nullable(),
  );
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for dates that exist on the calendar. A regex alone would happily
 * accept 2026-02-30, and `new Date()` would silently roll it over to 2 March.
 */
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Guards against typos like a year of 20226 or 1026. */
function isPlausibleYear(value: string): boolean {
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

export const medicationNameSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .string()
    .min(1, 'Please enter the name of the medicine.')
    .max(100, 'That name is too long — please use 100 characters or fewer.'),
);

export const expirationDateSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(ISO_DATE_PATTERN, 'Use the format YYYY-MM-DD, for example 2027-04-30.')
    .refine(isRealCalendarDate, 'That date does not exist. Please check it.')
    .refine(isPlausibleYear, 'Please enter a year between 2000 and 2100.')
    .nullable(),
);

export const medicationInputSchema = z.object({
  name: medicationNameSchema,
  dosage: optionalText(60, 'The dosage'),
  instructions: optionalText(300, 'The instructions'),
  expirationDate: expirationDateSchema,
  frequency: optionalText(60, 'The frequency'),
  notes: optionalText(500, 'The notes'),
});

/** A validated, normalised medicine, ready to be stored. */
export type MedicationInput = {
  name: string;
  dosage: string | null;
  instructions: string | null;
  expirationDate: string | null;
  frequency: string | null;
  notes: string | null;
};

/** Extra provenance fields, set by the scanner rather than typed by the user. */
export type MedicationCreateInput = MedicationInput & {
  source?: MedicationSource;
  scanConfidence?: number | null;
  imageUri?: string | null;
};

/**
 * Raw form state. Every field is a string because that is what a TextInput
 * produces; the schema above converts blanks to null.
 */
export type MedicationFormValues = {
  name: string;
  dosage: string;
  instructions: string;
  expirationDate: string;
  frequency: string;
  notes: string;
};

export const EMPTY_MEDICATION_FORM: MedicationFormValues = {
  name: '',
  dosage: '',
  instructions: '',
  expirationDate: '',
  frequency: '',
  notes: '',
};

/** Turn a stored medicine back into editable form values. */
export function toFormValues(medication: Medication): MedicationFormValues {
  return {
    name: medication.name,
    dosage: medication.dosage ?? '',
    instructions: medication.instructions ?? '',
    expirationDate: medication.expirationDate ?? '',
    frequency: medication.frequency ?? '',
    notes: medication.notes ?? '',
  };
}
