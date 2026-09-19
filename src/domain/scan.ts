/**
 * Label scanning — SCAN in the workflow.
 *
 * WHAT THE SCANNER RETURNS
 * `ScanResult` is the contract between the app and whatever reads the label:
 * the server-side vision model (Gemini / Claude via Railway) or the on-device
 * mock used in Demo Mode. It carries:
 *   - `rawText`      everything legible on the packaging, in reading order,
 *                    wording preserved — shown to the user beside the photo
 *   - `fields`       the structured values the reader could identify; each is
 *                    `null` when it was not printed or not legible
 *   - `confidence`   0–1 per field, so the app can flag "needs verification"
 *                    instead of silently trusting a guess
 *   - `warnings`     plain-language notes from the reader ("expiry partly
 *                    hidden by the cap")
 *
 * RULES (Phase 6 / 7)
 *   - nothing is auto-saved with an invented value: a field the reader was
 *     unsure about becomes `null` here, not a best guess
 *   - the medicine is saved to the list automatically ONLY when the name was
 *     read confidently; otherwise the user confirms the name first
 *   - no reminder is created from a scan — the user confirms times on the
 *     existing reminder screen
 */

import { z } from 'zod';

import { expirationDateSchema, medicationNameSchema, type Medication, type MedicationCreateInput } from './medication';

// ---------------------------------------------------------------------------
// Result contract (validated at the boundary — the reader is untrusted input)
// ---------------------------------------------------------------------------

const confidence = z.number().min(0).max(1);

function nullableText(max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null),
    z.string().max(max).nullable(),
  );
}

export const scanResultSchema = z.object({
  rawText: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().max(6000)),
  fields: z.object({
    name: nullableText(100),
    dosage: nullableText(60),
    frequency: nullableText(60),
    instructions: nullableText(300),
    /** The reader is asked for yyyy-MM-dd; anything else is dropped, not fixed up. */
    expirationDate: z.preprocess((v) => {
      const parsed = expirationDateSchema.safeParse(v);
      return parsed.success ? parsed.data : null;
    }, z.string().nullable()),
    manufacturer: nullableText(100),
    activeIngredients: nullableText(200),
  }),
  confidence: z.object({
    name: confidence.default(0),
    dosage: confidence.default(0),
    frequency: confidence.default(0),
    instructions: confidence.default(0),
    expirationDate: confidence.default(0),
  }),
  warnings: z.array(z.string().max(200)).max(10).default([]),
});

export type ScanResult = z.infer<typeof scanResultSchema>;
export type ScanField = keyof ScanResult['fields'];

/** Fields the app saves onto a medicine, with their confidence. */
export const SCANNED_MEDICATION_FIELDS = ['name', 'dosage', 'frequency', 'instructions', 'expirationDate'] as const;
export type ScannedMedicationField = (typeof SCANNED_MEDICATION_FIELDS)[number];

/** Below this a field is shown with a "check this" mark and not trusted for safety. */
export const FIELD_CONFIDENCE_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// From a result to a medicine
// ---------------------------------------------------------------------------

/**
 * The name is the one field that must be right for the entry to mean
 * anything, so it needs a confident read; otherwise the user confirms it.
 */
export function needsNameConfirmation(result: ScanResult): boolean {
  return !result.fields.name || result.confidence.name < FIELD_CONFIDENCE_THRESHOLD;
}

/** A field read below the threshold is kept (it is what the label says) but flagged. */
export function isUncertain(result: ScanResult, field: ScannedMedicationField): boolean {
  return result.fields[field] !== null && result.confidence[field] < FIELD_CONFIDENCE_THRESHOLD;
}

/** Overall confidence stored on the medicine: the weakest of the fields that were read. */
export function overallConfidence(result: ScanResult): number {
  const read = SCANNED_MEDICATION_FIELDS.filter((field) => result.fields[field] !== null);
  if (read.length === 0) return 0;
  return Math.min(...read.map((field) => result.confidence[field]));
}

/**
 * Build the create input. `confirmedName` overrides the read name when the
 * user typed or corrected it. Only label-read fields are filled; notes stay
 * empty so what the user writes is never mixed with what the label said.
 */
export function scanToMedicationInput(
  result: ScanResult,
  options: { memberId: string; confirmedName?: string; imageUri: string | null },
): MedicationCreateInput | null {
  const name = medicationNameSchema.safeParse(options.confirmedName ?? result.fields.name ?? '');
  if (!name.success) return null;

  return {
    name: name.data,
    dosage: result.fields.dosage,
    frequency: result.fields.frequency,
    instructions: result.fields.instructions,
    expirationDate: result.fields.expirationDate,
    notes: null,
    memberId: options.memberId,
    source: 'SCAN',
    scanConfidence: overallConfidence(result),
    imageUri: options.imageUri,
    labelText: result.rawText.length > 0 ? result.rawText : null,
  };
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

/** Lower-case, collapse spaces, drop punctuation — "Panadol  Extra." ≈ "panadol extra". */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The same member's medicine with the same name, if any. */
export function findDuplicate(
  medications: readonly Pick<Medication, 'id' | 'name' | 'memberId' | 'archived'>[],
  name: string,
  memberId: string,
): Pick<Medication, 'id' | 'name' | 'memberId' | 'archived'> | null {
  const wanted = normaliseName(name);
  if (wanted.length === 0) return null;
  return (
    medications.find((m) => !m.archived && m.memberId === memberId && normaliseName(m.name) === wanted) ?? null
  );
}

// ---------------------------------------------------------------------------
// Demo scenarios (Phase 19) — used by the mock scanner
// ---------------------------------------------------------------------------

export const DEMO_SCENARIOS = ['SAFE', 'EXPIRED', 'UNREADABLE'] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

/** Fixed results, so the demonstration is identical every time. */
export function demoScanResult(scenario: DemoScenario, today: Date = new Date()): ScanResult {
  const year = today.getFullYear();
  switch (scenario) {
    case 'SAFE':
      return {
        rawText:
          `Demo Medicine 500 mg\nParacetamol\n20 film-coated tablets\n` +
          `Adults and children over 16: take 1 or 2 tablets every 4 to 6 hours. Do not take more than 8 tablets in 24 hours.\n` +
          `Store below 25°C. Keep out of the sight and reach of children.\n` +
          `EXP ${year + 2}-04-30  LOT 4471A\nDemo Pharma Ltd`,
        fields: {
          name: 'Demo Medicine',
          dosage: '500 mg',
          frequency: 'Every 6 hours',
          instructions: 'Do not take more than 8 tablets in 24 hours',
          expirationDate: `${year + 2}-04-30`,
          manufacturer: 'Demo Pharma Ltd',
          activeIngredients: 'Paracetamol',
        },
        confidence: { name: 0.96, dosage: 0.94, frequency: 0.85, instructions: 0.9, expirationDate: 0.93 },
        warnings: [],
      };
    case 'EXPIRED':
      return {
        rawText:
          `Expired Demo Medicine 10 mg\nCetirizine dihydrochloride\n14 tablets\n` +
          `Adults: one tablet daily.\nEXP ${year - 1}-01-31  BN 2209\nDemo Pharma Ltd`,
        fields: {
          name: 'Expired Demo Medicine',
          dosage: '10 mg',
          frequency: 'Once daily',
          instructions: null,
          expirationDate: `${year - 1}-01-31`,
          manufacturer: 'Demo Pharma Ltd',
          activeIngredients: 'Cetirizine dihydrochloride',
        },
        confidence: { name: 0.95, dosage: 0.92, frequency: 0.9, instructions: 0, expirationDate: 0.97 },
        warnings: [],
      };
    case 'UNREADABLE':
      return {
        rawText: `...ol 2..mg\n...ablets\n(label scratched)\nEXP 0?/2?`,
        fields: {
          name: null,
          dosage: null,
          frequency: null,
          instructions: null,
          expirationDate: null,
          manufacturer: null,
          activeIngredients: null,
        },
        confidence: { name: 0.2, dosage: 0.1, frequency: 0, instructions: 0, expirationDate: 0.1 },
        warnings: ['Most of the label is scratched or blurred. Nothing could be read with confidence.'],
      };
  }
}
