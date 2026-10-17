/**
 * Label scanning rules (SCAN → CHECK → CONFIRM).
 *
 * The reader is untrusted input, so the schema tests matter as much as the
 * rules: a malformed date or an over-long field must be dropped, never
 * "fixed up" into something that looks real.
 */

import {
  applyConflicts,
  DEMO_SCENARIOS,
  demoScanResult,
  displayField,
  formFromLabel,
  groundResult,
  kindFromLabel,
  UNGROUNDED_CONFIDENCE,
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
    form: null,
    quantity: null,
    batchNumber: null,
    storage: null,
    warningsText: null,
  },
  confidence: { name: 0.95, dosage: 0.9, frequency: 0, instructions: 0, expirationDate: 0.8 },
  warnings: [],
  translation: null,
  conflicts: [],
  differentMedicines: false,
  unclear: [],
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
      kind: null,
      form: 'TABLET', // "20 tablets" is printed on the label
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

describe('translation (Arabic display)', () => {
  it('is null by default and validated when present', () => {
    expect(scanResultSchema.safeParse(READ).success && scanResultSchema.parse(READ).translation).toBeNull();
    const parsed = scanResultSchema.safeParse({
      ...READ,
      translation: { language: 'ar', name: ' بانادول ', dosage: '500 ملغ', frequency: '', instructions: null, activeIngredients: null, rawText: 'بانادول 500 ملغ' },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.translation?.name).toBe('بانادول');
    expect(parsed.data.translation?.frequency).toBeNull();
    expect(scanResultSchema.safeParse({ ...READ, translation: { language: 'fr', rawText: '' } }).success).toBe(false);
  });

  it('displayField shows the translation in Arabic and the printed text otherwise', () => {
    const translated: ScanResult = {
      ...READ,
      translation: { language: 'ar', name: 'بانادول', dosage: null, frequency: null, instructions: null, activeIngredients: null, rawText: '' },
    };
    expect(displayField(translated, 'name', 'ar')).toBe('بانادول');
    expect(displayField(translated, 'name', 'en')).toBe('Panadol');
    // No translation for that field → the printed wording, never blank.
    expect(displayField(translated, 'dosage', 'ar')).toBe('500 mg');
    // Dates and manufacturer are never translated.
    expect(displayField(translated, 'expirationDate', 'ar')).toBe('2028-04-30');
    expect(displayField(READ, 'name', 'ar')).toBe('Panadol');
  });

  it('demo readings carry an Arabic translation only when asked in Arabic', () => {
    expect(demoScanResult('SAFE', TODAY, 'en').translation).toBeNull();
    const ar = demoScanResult('SAFE', TODAY, 'ar');
    expect(ar.translation?.language).toBe('ar');
    expect(ar.translation?.name).toBeTruthy();
    expect(scanResultSchema.safeParse(ar).success).toBe(true);
    // The stored fields stay as printed.
    expect(scanToMedicationInput(ar, { memberId: 'self', imageUri: null })?.name).toBe('Demo Medicine');
  });
});

describe('groundResult — a value not in the transcription is not trusted', () => {
  const messages = { nameNotOnLabel: 'NAME?', dosageNotOnLabel: 'DOSE?', expiryNotOnLabel: 'EXPIRY?' };
  const iron: ScanResult = {
    ...READ,
    rawText: 'FERROUS SULPHATE 200mg\n28 tablets\nIron supplement\nEXP 03/2027',
    fields: { ...READ.fields, name: 'Ferrous Sulphate', dosage: '200 mg', expirationDate: '2027-03-31', activeIngredients: 'Ferrous sulphate' },
    confidence: { name: 0.95, dosage: 0.95, frequency: 0, instructions: 0, expirationDate: 0.9 },
  };

  it('keeps a reading whose name, strength and expiry year are printed', () => {
    expect(groundResult(iron, messages)).toEqual(iron);
  });

  it('caps the name when the picked-out name is not printed (e.g. a guessed paracetamol)', () => {
    const guessed = groundResult({ ...iron, fields: { ...iron.fields, name: 'Paracetamol' } }, messages);
    expect(guessed.confidence.name).toBe(UNGROUNDED_CONFIDENCE);
    expect(needsNameConfirmation(guessed)).toBe(true);
    expect(guessed.warnings).toContain('NAME?');
    // The printed text and other fields are untouched.
    expect(guessed.rawText).toBe(iron.rawText);
    expect(guessed.confidence.dosage).toBe(0.95);
  });

  it('caps the strength and the expiry when their numbers are not printed', () => {
    const wrong = groundResult({ ...iron, fields: { ...iron.fields, dosage: '500 mg', expirationDate: '2029-03-31' } }, messages);
    expect(wrong.confidence.dosage).toBe(UNGROUNDED_CONFIDENCE);
    expect(wrong.confidence.expirationDate).toBe(UNGROUNDED_CONFIDENCE);
    expect(wrong.warnings).toEqual(['DOSE?', 'EXPIRY?']);
  });

  it('ignores case, punctuation and run-together words, and leaves an empty transcription alone', () => {
    const ok = groundResult({ ...iron, rawText: 'ferrous-sulphate 200MG exp 2027' }, messages);
    expect(ok.confidence.name).toBe(0.95);
    const empty = groundResult({ ...iron, rawText: '' }, messages);
    expect(empty).toEqual({ ...iron, rawText: '' });
  });
});

describe('form and kind from the printed words', () => {
  it('maps the printed dosage form to the list and leaves unknown forms null', () => {
    expect(formFromLabel('Film-coated tablets')).toBe('TABLET');
    expect(formFromLabel('30 capsules')).toBe('CAPSULE');
    expect(formFromLabel('Oral drops')).toBe('DROPS');
    expect(formFromLabel('شراب')).toBe('LIQUID');
    expect(formFromLabel('Pessary')).toBeNull();
    expect(formFromLabel(null)).toBeNull();
  });

  it('recognises a supplement only from supplement wording', () => {
    expect(kindFromLabel('Ferrous Sulphate 200 mg Iron food supplement')).toBe('SUPPLEMENT');
    expect(kindFromLabel('Vitamin D3 1000 IU')).toBe('SUPPLEMENT');
    expect(kindFromLabel('Paracetamol 500 mg tablets')).toBeNull();
  });

  it('carries form and kind into the medicine created from a scan', () => {
    const iron: ScanResult = {
      ...READ,
      rawText: 'Ferrous Sulphate 200 mg\nIron supplement\n28 tablets',
      fields: { ...READ.fields, name: 'Ferrous Sulphate', dosage: '200 mg', form: 'tablets' },
    };
    const input = scanToMedicationInput(iron, { memberId: 'self', imageUri: null });
    expect(input?.name).toBe('Ferrous Sulphate');
    expect(input?.form).toBe('TABLET');
    expect(input?.kind).toBe('SUPPLEMENT');
    expect(scanToMedicationInput({ ...READ, rawText: 'Panadol 500 mg' }, { memberId: 'self', imageUri: null })?.form).toBeNull();
  });
});

describe('several photos of one medicine', () => {
  it('accepts the multi-photo flags and defaults them for older servers', () => {
    const legacy = scanResultSchema.parse({ ...READ, conflicts: undefined, differentMedicines: undefined, unclear: undefined });
    expect(legacy.conflicts).toEqual([]);
    expect(legacy.differentMedicines).toBe(false);
    expect(legacy.unclear).toEqual([]);

    const flagged = scanResultSchema.parse({
      ...READ,
      conflicts: [{ field: 'dosage', note: 'front says 500 mg, back says 650 mg' }],
      differentMedicines: true,
      unclear: ['expirationDate'],
    });
    expect(flagged.conflicts).toHaveLength(1);
    expect(flagged.differentMedicines).toBe(true);
    expect(flagged.unclear).toEqual(['expirationDate']);
  });

  it('caps the confidence of a conflicting field so the user must check it', () => {
    const result = applyConflicts({ ...READ, conflicts: [{ field: 'name', note: 'two names' }, { field: 'nope', note: 'x' }] });
    expect(result.confidence.name).toBe(UNGROUNDED_CONFIDENCE);
    expect(needsNameConfirmation(result)).toBe(true);
    expect(result.confidence.dosage).toBe(0.9);
    expect(applyConflicts(READ)).toBe(READ);
  });

  it('keeps the extra printed details (quantity, batch, storage, warnings) in the reading', () => {
    const parsed = scanResultSchema.parse({
      ...READ,
      fields: { ...READ.fields, quantity: '28 tablets', batchNumber: ' 4471A ', storage: 'Store below 25°C', warningsText: 'Keep out of reach of children' },
    });
    expect(parsed.fields.quantity).toBe('28 tablets');
    expect(parsed.fields.batchNumber).toBe('4471A');
    // Shown and kept in the label text, never stored as separate columns.
    const input = scanToMedicationInput(parsed, { memberId: 'self', imageUri: null });
    expect(input).not.toHaveProperty('quantity');
    expect(displayField(parsed, 'quantity', 'ar')).toBe('28 tablets');
  });
});
