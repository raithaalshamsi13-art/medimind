import {
  CONDITION_PRESETS,
  CONDITION_TYPES,
  conditionDisplayName,
  healthConditionInputSchema,
  toConditionFormValues,
} from '@/domain/healthCondition';

describe('healthConditionInputSchema', () => {
  it('accepts a preset condition with blanks turned into null', () => {
    const parsed = healthConditionInputSchema.safeParse({
      type: 'HIGH_BLOOD_PRESSURE',
      customName: '',
      reading: ' 130/85 ',
      notes: '   ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        type: 'HIGH_BLOOD_PRESSURE',
        customName: null,
        reading: '130/85',
        notes: null,
      });
    }
  });

  it('requires a name for "Other"', () => {
    const missing = healthConditionInputSchema.safeParse({
      type: 'OTHER',
      customName: '',
      reading: '',
      notes: '',
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.path).toEqual(['customName']);
    }

    const named = healthConditionInputSchema.safeParse({
      type: 'OTHER',
      customName: 'Migraine',
      reading: '',
      notes: '',
    });
    expect(named.success).toBe(true);
  });

  it('drops a custom name given for a preset condition', () => {
    const parsed = healthConditionInputSchema.safeParse({
      type: 'ASTHMA',
      customName: 'should be ignored',
      reading: '',
      notes: '',
    });
    expect(parsed.success && parsed.data.customName).toBeNull();
  });

  it('rejects a type outside the list', () => {
    expect(
      healthConditionInputSchema.safeParse({
        type: 'SOMETHING_ELSE',
        customName: '',
        reading: '',
        notes: '',
      }).success,
    ).toBe(false);
  });

  it('limits field lengths', () => {
    expect(
      healthConditionInputSchema.safeParse({
        type: 'DIABETES',
        customName: '',
        reading: 'x'.repeat(41),
        notes: '',
      }).success,
    ).toBe(false);
  });
});

describe('presets', () => {
  it('has one preset per condition type, and reading hints are examples, not targets', () => {
    expect(CONDITION_PRESETS.map((p) => p.type)).toEqual([...CONDITION_TYPES]);
    for (const preset of CONDITION_PRESETS) {
      if (preset.readingHint) expect(preset.readingHint).toMatch(/^e\.g\. /);
    }
  });

  it('shows the custom name only for "Other"', () => {
    expect(conditionDisplayName({ type: 'OTHER', customName: 'Migraine' })).toBe('Migraine');
    expect(conditionDisplayName({ type: 'DIABETES', customName: 'ignored' })).toBe('Diabetes');
  });

  it('turns a stored condition back into editable strings', () => {
    expect(
      toConditionFormValues({
        id: 'c1',
        userId: 'u1',
        type: 'OTHER',
        customName: 'Migraine',
        reading: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({ type: 'OTHER', customName: 'Migraine', reading: '', notes: '' });
  });
});
