/**
 * Long-term health conditions the user chooses to record.
 *
 * SCOPE — READ THIS FIRST
 * This is an organisational record, like a notebook page: the user writes
 * down "High blood pressure — last reading 130/85". MediMind stores and
 * displays that text. It never interprets a reading, never compares it with a
 * target range, never colours it good or bad, and never uses a condition to
 * suggest, warn about or judge a medicine. Conditions are also not sent to the
 * assistant. Anything beyond storage would be diagnosis, which the project's
 * safety rules forbid.
 *
 * Conditions belong to the USER, not to one medicine: someone with diabetes
 * may relate several medicines to it. A medicine links to conditions by id
 * (see `Medication.conditionIds`).
 */

import { z } from 'zod';

export const CONDITION_TYPES = [
  'HIGH_BLOOD_PRESSURE',
  'DIABETES',
  'LOW_BLOOD_SUGAR',
  'ASTHMA',
  'HIGH_CHOLESTEROL',
  'HEART',
  'THYROID',
  'KIDNEY',
  'ARTHRITIS',
  'OTHER',
] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export type ConditionPreset = {
  type: ConditionType;
  label: string;
  /** What the "latest reading" field is for, shown as a placeholder. */
  readingHint: string | null;
};

/**
 * The list the user picks from. The reading hints are format examples only —
 * they say what a reading *looks like*, never what it should be.
 */
export const CONDITION_PRESETS: readonly ConditionPreset[] = [
  { type: 'HIGH_BLOOD_PRESSURE', label: 'High blood pressure', readingHint: 'e.g. 130/85' },
  { type: 'DIABETES', label: 'Diabetes', readingHint: 'e.g. 6.2 mmol/L or HbA1c 48' },
  { type: 'LOW_BLOOD_SUGAR', label: 'Low blood sugar', readingHint: 'e.g. 3.8 mmol/L' },
  { type: 'ASTHMA', label: 'Asthma', readingHint: 'e.g. peak flow 420' },
  { type: 'HIGH_CHOLESTEROL', label: 'High cholesterol', readingHint: 'e.g. 5.1 mmol/L' },
  { type: 'HEART', label: 'Heart condition', readingHint: 'e.g. resting pulse 72' },
  { type: 'THYROID', label: 'Thyroid condition', readingHint: 'e.g. TSH 2.1' },
  { type: 'KIDNEY', label: 'Kidney condition', readingHint: 'e.g. eGFR 58' },
  { type: 'ARTHRITIS', label: 'Arthritis', readingHint: null },
  { type: 'OTHER', label: 'Other', readingHint: null },
];

export const CONDITION_LABELS: Record<ConditionType, string> = Object.fromEntries(
  CONDITION_PRESETS.map((preset) => [preset.type, preset.label]),
) as Record<ConditionType, string>;

export function conditionPreset(type: ConditionType): ConditionPreset {
  return CONDITION_PRESETS.find((preset) => preset.type === type) ?? CONDITION_PRESETS[0];
}

export type HealthCondition = {
  id: string;
  userId: string;
  type: ConditionType;
  /** The user's own name for the condition. Required when type is OTHER. */
  customName: string | null;
  /** The latest value the user chose to note down, as typed. Never parsed. */
  reading: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** "High blood pressure", or the custom name for an OTHER condition. */
export function conditionDisplayName(condition: Pick<HealthCondition, 'type' | 'customName'>): string {
  if (condition.type === 'OTHER' && condition.customName) return condition.customName;
  return CONDITION_LABELS[condition.type];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

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

export const healthConditionInputSchema = z
  .object({
    type: z.enum(CONDITION_TYPES, { message: 'Please choose a condition from the list.' }),
    customName: optionalText(60, 'The condition name'),
    reading: optionalText(40, 'The reading'),
    notes: optionalText(300, 'The notes'),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'OTHER' && !value.customName) {
      ctx.addIssue({
        code: 'custom',
        path: ['customName'],
        message: 'Please give this condition a name.',
      });
    }
  })
  .transform((value) => ({
    ...value,
    // A custom name only means something for OTHER; drop it otherwise so the
    // display name is always the preset label.
    customName: value.type === 'OTHER' ? value.customName : null,
  }));

export type HealthConditionInput = {
  type: ConditionType;
  customName: string | null;
  reading: string | null;
  notes: string | null;
};

/** Raw form state — strings, as a TextInput produces them. */
export type HealthConditionFormValues = {
  type: ConditionType | '';
  customName: string;
  reading: string;
  notes: string;
};

export const EMPTY_CONDITION_FORM: HealthConditionFormValues = {
  type: '',
  customName: '',
  reading: '',
  notes: '',
};

export function toConditionFormValues(condition: HealthCondition): HealthConditionFormValues {
  return {
    type: condition.type,
    customName: condition.customName ?? '',
    reading: condition.reading ?? '',
    notes: condition.notes ?? '',
  };
}
