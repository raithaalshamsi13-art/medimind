/**
 * Label scanning rules (SCAN → CHECK → CONFIRM).
 *
 * The reader is untrusted input, so the schema tests matter as much as the
 * rules: a malformed date or an over-long field must be dropped, never
 * "fixed up" into something that looks real.
 */

import {
  DEMO_SCENARIOS,
  demoScanResult,
  FIELD_CONFIDENCE_THRESHOLD,
  findDuplicate,
  isUncertain,
  needsNameConfirmation,
  normaliseName,
  overallConfidence,
  scanResultSchema,
  scanToMedicationInput,
  type ScanResult,
} from '@/domain/scan';

const TODAY = new Date(2026, 8, 19);

const READ: ScanResult = {
  rawText: 'Panadol 500 mg\n20 tablets\nEXP 2028-04-30',
  fields: {
    name: 'Panadol',
    dosage: '500 mg',
    frequency: null,
    instructions: null,
    expirationDate: '2028-04-30',
    manufacturer: null,
    activeIngredients: 'Paracetamol',
  },
  confidence: { name: 0.95, dosage: 0.9, frequency: 0, instructions: 0, expirationDate: 0.8 },
  warnings: [],
};

describe('scanResultSchema', () => {
  it('accepts a well-formed reading and trims the text fields', () => {
    const parsed = scanResultSchema.safeParse({
      ...READ,
      fields: { ...READ.fields, name: '  Panadol ' },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.fields.name).toBe('Panadol');
  });

  it('turns blanks into null and fills missing confidence with 0', () => {
    const parsed = scanResultSchema.safeParse({
      rawText: undefined,
      fields: { name: '', dosage: '   ', frequency: null, instructions: null, expirationDate: null, manufacturer: null, activeIngredients: null },
      confidence: {},
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.rawText).toBe('');
    expect(parsed.data.fields.name).toBeNull();
    expect(parsed.data.fields.dosage).toBeNull();
    expect(parsed.data.confidence.name).toBe(0);
    expect(parsed.data.warnings).toEqual([]);
  });

  it('drops an expiry date that is not yyyy-MM-dd rather than guessing', () => {
    const parsed = scanResultSchema.safeParse({
      ...READ,
      fields: { ...READ.fields, expirationDate: '04/2028' },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.fields.expirationDate).toBeNull();
  });

  it('rejects a confidence outside 0–1 and an over-long name', () => {
    expect(scanResultSchema.safeParse({ ...READ, confidence: { ...READ.confidence, name: 1.5 } }).success).toBe(false);
    expect(
      scanResultSchema.safeParse({ ...READ, fields: { ...READ.fields, name: 'x'.repeat(101) } }).success,
    ).toBe(false);
  });
});

describe('needsNameConfirmation / isUncertain / overallConfidence', () => {
  it('trusts a confident name and asks about a weak or missing one', () => {
    expect(needsNameConfirmation(READ)).toBe(false);
    expect(needsNameConfirmation({ ...READ, confidence: { ...READ.confidence, name: FIELD_CONFIDENCE_THRESHOLD - 0.01 } })).toBe(true);
    expect(needsNameConfirmation({ ...READ, fields: { ...READ.fields, name: null } })).toBe(true);
  });

  it('flags a field that was read but below the threshold, not one that is absent', () => {
    const weak = { ...READ, confidence: { ...READ.confidence, dosage: 0.4 } };
    expect(isUncertain(weak, 'dosage')).toBe(true);
    expect(isUncertain(weak, 'frequency')).toBe(false);
    expect(isUncertain(READ, 'dosage')).toBe(false);
  });

  it('uses the weakest read field as the overall confidence', () => {
    expect(overallConfidence(READ)).toBeCloseTo(0.8);
    expect(overallConfidence({ ...READ, fields: { ...READ.fields, name: null, dosage: null, expirationDate: null } })).toBe(0);
  });
});

describe('scanToMedicationInput', () => {
  it('builds a scanned medicine from label-read fields only', () => {
    const input = scanToMedicationInput(READ, { memberId: 'self', imageUri: 'file:///scan.jpg' });
    expect(input).toEqual({
      name: 'Panadol',
      dosage: '500 mg',
      frequency: null,
      instructions: null,
      expirationDate: '2028-04-30',
      notes: null,
      memberId: 'self',
      source: 'SCAN',
      scanConfidence: 0.8,
      imageUri: 'file:///scan.jpg',
      labelText: READ.rawText,
    });
  });

  it('uses the confirmed name over the read one, and refuses an empty name', () => {
    expect(scanToMedicationInput(READ, { memberId: 'self', confirmedName: 'Panadol Extra', imageUri: null })?.name).toBe(
      'Panadol Extra',
    );
    expect(scanToMedicationInput({ ...READ, fields: { ...READ.fields, name: null } }, { memberId: 'self', imageUri: null })).toBeNull();
  });

  it('stores no label text when nothing was read', () => {
    expect(scanToMedicationInput({ ...READ, rawText: '' }, { memberId: 'self', imageUri: null })?.labelText).toBeNull();
  });
});

describe('duplicates', () => {
  const list = [
    { id: 'a', name: 'Panadol Extra', memberId: 'self', archived: false },
    { id: 'b', name: 'Panadol Extra', memberId: 'mother', archived: false },
    { id: 'c', name: 'Aspirin', memberId: 'self', archived: true },
  ];

  it('normalises case, spacing and punctuation', () => {
    expect(normaliseName('  Panadol   EXTRA. ')).toBe('panadol extra');
    expect(normaliseName('')).toBe('');
  });

  it('finds the same medicine for the same person only', () => {
    expect(findDuplicate(list, 'panadol extra', 'self')?.id).toBe('a');
    expect(findDuplicate(list, 'Panadol Extra', 'father')).toBeNull();
    expect(findDuplicate(list, 'Aspirin', 'self')).toBeNull(); // archived
    expect(findDuplicate(list, '', 'self')).toBeNull();
  });
});

describe('demo scenarios', () => {
  it('provides a fixed reading for each scenario that passes the schema', () => {
    for (const scenario of DEMO_SCENARIOS) {
      expect(scanResultSchema.safeParse(demoScanResult(scenario, TODAY)).success).toBe(true);
    }
  });

  it('safe is confident and in date; expired is in the past; unreadable has no name', () => {
    expect(needsNameConfirmation(demoScanResult('SAFE', TODAY))).toBe(false);
    expect(demoScanResult('SAFE', TODAY).fields.expirationDate).toBe('2028-04-30');
    expect(demoScanResult('EXPIRED', TODAY).fields.expirationDate).toBe('2025-01-31');
    expect(needsNameConfirmation(demoScanResult('UNREADABLE', TODAY))).toBe(true);
    expect(demoScanResult('UNREADABLE', TODAY).warnings.length).toBeGreaterThan(0);
  });
});
