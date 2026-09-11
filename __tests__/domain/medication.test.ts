/**
 * Medication validation.
 *
 * PHASE 8 RULE: "do not allow obviously invalid data". These are the rules that
 * enforce it, and they are shared by the manual entry form, the edit form and
 * (from Milestone 4) the validator applied to AI-extracted label data.
 *
 * The null-handling cases matter most: a blank field must become `null`
 * ("could not be determined"), never an empty string pretending to be a value.
 */

import { medicationInputSchema, toFormValues, type Medication } from '@/domain/medication';

const VALID = {
  name: 'Paracetamol',
  dosage: '500 mg',
  instructions: 'Take with food',
  expirationDate: '2027-04-30',
  frequency: 'Twice daily',
  notes: '',
};

describe('medicationInputSchema', () => {
  it('accepts a complete, valid medicine', () => {
    const result = medicationInputSchema.safeParse(VALID);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('Paracetamol');
    expect(result.data.expirationDate).toBe('2027-04-30');
  });

  it('trims whitespace from the name', () => {
    const result = medicationInputSchema.safeParse({ ...VALID, name: '  Aspirin  ' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('Aspirin');
  });

  it('converts blank optional fields to null, not empty strings', () => {
    const result = medicationInputSchema.safeParse({
      name: 'Mystery tablets',
      kind: '',
      form: '',
      dosage: '',
      instructions: '   ',
      expirationDate: '',
      frequency: '',
      notes: '',
      conditionIds: [],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // null means "could not be determined" — an empty string would look like
    // a real answer to every screen that renders it.
    expect(result.data.dosage).toBeNull();
    expect(result.data.instructions).toBeNull();
    expect(result.data.expirationDate).toBeNull();
    expect(result.data.frequency).toBeNull();
    expect(result.data.notes).toBeNull();
  });

  describe('name', () => {
    it('is required', () => {
      const result = medicationInputSchema.safeParse({ ...VALID, name: '' });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0].path[0]).toBe('name');
    });

    it('rejects whitespace-only', () => {
      expect(medicationInputSchema.safeParse({ ...VALID, name: '    ' }).success).toBe(false);
    });

    it('rejects an absurdly long name', () => {
      const result = medicationInputSchema.safeParse({ ...VALID, name: 'x'.repeat(101) });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0].message).toContain('100 characters');
    });
  });

  describe('expirationDate', () => {
    it('rejects a non-ISO format', () => {
      const result = medicationInputSchema.safeParse({ ...VALID, expirationDate: '30/04/2027' });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0].message).toContain('YYYY-MM-DD');
    });

    it('rejects a date that does not exist on the calendar', () => {
      // A regex alone would accept this, and `new Date()` would silently roll
      // it over to 2 March — quietly changing a medical expiry date.
      const result = medicationInputSchema.safeParse({ ...VALID, expirationDate: '2026-02-30' });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0].message).toContain('does not exist');
    });

    it('rejects month 13', () => {
      expect(
        medicationInputSchema.safeParse({ ...VALID, expirationDate: '2027-13-01' }).success,
      ).toBe(false);
    });

    it('accepts a real leap day', () => {
      const result = medicationInputSchema.safeParse({ ...VALID, expirationDate: '2028-02-29' });
      expect(result.success).toBe(true);
    });

    it('rejects a leap day in a non-leap year', () => {
      expect(
        medicationInputSchema.safeParse({ ...VALID, expirationDate: '2027-02-29' }).success,
      ).toBe(false);
    });

    it('rejects an implausible year (likely a typo)', () => {
      const result = medicationInputSchema.safeParse({ ...VALID, expirationDate: '1027-04-30' });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0].message).toContain('2000 and 2100');
    });
  });

  describe('length limits', () => {
    it('rejects an over-long dosage', () => {
      expect(
        medicationInputSchema.safeParse({ ...VALID, dosage: 'x'.repeat(61) }).success,
      ).toBe(false);
    });

    it('rejects over-long instructions', () => {
      expect(
        medicationInputSchema.safeParse({ ...VALID, instructions: 'x'.repeat(301) }).success,
      ).toBe(false);
    });
  });
});

describe('toFormValues', () => {
  it('renders nulls as empty strings so they can be edited', () => {
    const medication: Medication = {
      id: 'm1',
      userId: 'u1',
      name: 'Mystery tablets',
      kind: null,
      form: null,
      conditionIds: [],
      dosage: null,
      instructions: null,
      expirationDate: null,
      frequency: null,
      safetyStatus: 'UNKNOWN',
      source: 'MANUAL',
      scanConfidence: null,
      notes: null,
      imageUri: null,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(toFormValues(medication)).toEqual({
      name: 'Mystery tablets',
      kind: '',
      form: '',
      dosage: '',
      instructions: '',
      expirationDate: '',
      frequency: '',
      notes: '',
      conditionIds: [],
    });
  });
});
