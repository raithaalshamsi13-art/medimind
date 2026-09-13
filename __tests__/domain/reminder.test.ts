import {
  dateKeysBetween,
  describeDays,
  describeTimes,
  isActionable,
  isPastGrace,
  occurrencesOn,
  reminderInputSchema,
  remindsOn,
  suggestReminder,
  type Reminder,
} from '@/domain/reminder';

const BASE: Reminder = {
  id: 'r1',
  userId: 'u1',
  memberId: 'f1',
  medicationId: 'm1',
  times: ['08:00', '20:00'],
  doseLabel: '500 mg',
  frequency: 'DAILY',
  days: [],
  startDate: null,
  endDate: null,
  enabled: true,
  notificationIds: [],
  createdAt: '',
  updatedAt: '',
};

describe('suggestReminder', () => {
  const today = new Date(2026, 8, 14);

  it('suggests times from the recorded frequency and carries the recorded dose', () => {
    expect(
      suggestReminder({ frequency: 'Twice daily', dosage: '500 mg', expirationDate: '2027-01-01' }, today),
    ).toEqual({ kind: 'suggested', times: ['08:00', '20:00'], description: 'twice daily', doseLabel: '500 mg' });
  });

  it('refuses to suggest for an expired medicine (Phase 7)', () => {
    const result = suggestReminder(
      { frequency: 'Twice daily', dosage: '500 mg', expirationDate: '2026-01-01' },
      today,
    );
    expect(result.kind).toBe('blocked');
  });

  it('has nothing to suggest when the wording is not understood, and never guesses', () => {
    expect(suggestReminder({ frequency: 'as directed', dosage: null, expirationDate: null }, today)).toEqual({
      kind: 'none',
      doseLabel: null,
    });
    expect(suggestReminder({ frequency: null, dosage: '1 tablet', expirationDate: null }, today)).toEqual({
      kind: 'none',
      doseLabel: '1 tablet',
    });
  });

  it('flags "as needed" separately — no fixed times', () => {
    expect(suggestReminder({ frequency: 'as needed', dosage: '10 mg', expirationDate: null }, today)).toEqual({
      kind: 'as-needed',
      doseLabel: '10 mg',
    });
  });
});

describe('reminderInputSchema', () => {
  const valid = {
    times: ['20:00', '08:00', '08:00'],
    doseLabel: ' 500 mg ',
    frequency: 'DAILY',
    days: [1, 3],
    startDate: '',
    endDate: '',
    enabled: true,
  };

  it('sorts and de-duplicates times, trims the label, ignores days for DAILY', () => {
    const parsed = reminderInputSchema.safeParse(valid);
    expect(parsed.success && parsed.data).toEqual({
      times: ['08:00', '20:00'],
      doseLabel: '500 mg',
      frequency: 'DAILY',
      days: [],
      startDate: null,
      endDate: null,
      enabled: true,
    });
  });

  it('requires at least one time and a valid clock time', () => {
    expect(reminderInputSchema.safeParse({ ...valid, times: [] }).success).toBe(false);
    expect(reminderInputSchema.safeParse({ ...valid, times: ['25:00'] }).success).toBe(false);
    expect(reminderInputSchema.safeParse({ ...valid, times: ['8:00'] }).success).toBe(false);
  });

  it('requires days for SPECIFIC_DAYS and an end date after the start', () => {
    const noDays = reminderInputSchema.safeParse({ ...valid, frequency: 'SPECIFIC_DAYS', days: [] });
    expect(noDays.success).toBe(false);
    if (!noDays.success) expect(noDays.error.issues[0]?.path).toEqual(['days']);

    const backwards = reminderInputSchema.safeParse({ ...valid, startDate: '2026-09-20', endDate: '2026-09-10' });
    expect(backwards.success).toBe(false);
    if (!backwards.success) expect(backwards.error.issues[0]?.path).toEqual(['endDate']);

    const ok = reminderInputSchema.safeParse({ ...valid, frequency: 'SPECIFIC_DAYS', days: [5, 1, 1] });
    expect(ok.success && ok.data.days).toEqual([1, 5]);
  });
});

describe('occurrences', () => {
  const monday = new Date(2026, 8, 14); // 14 Sep 2026 is a Monday
  const sunday = new Date(2026, 8, 13);

  it('fires every day for DAILY within the date range', () => {
    expect(occurrencesOn(BASE, monday)).toEqual(['2026-09-14T08:00', '2026-09-14T20:00']);
    expect(remindsOn({ ...BASE, startDate: '2026-09-15' }, monday)).toBe(false);
    expect(remindsOn({ ...BASE, endDate: '2026-09-13' }, monday)).toBe(false);
    expect(remindsOn({ ...BASE, enabled: false }, monday)).toBe(false);
  });

  it('fires only on the chosen weekdays for SPECIFIC_DAYS', () => {
    const weekdays: Reminder = { ...BASE, frequency: 'SPECIFIC_DAYS', days: [1, 3, 5] };
    expect(occurrencesOn(weekdays, monday)).toHaveLength(2);
    expect(occurrencesOn(weekdays, sunday)).toEqual([]);
  });

  it('lists every day of a range inclusive', () => {
    expect(dateKeysBetween(new Date(2026, 8, 12), new Date(2026, 8, 14))).toEqual([
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
    ]);
  });
});

describe('timing', () => {
  it('counts a dose as missed only after the grace window', () => {
    expect(isPastGrace('2026-09-14T08:00', new Date(2026, 8, 14, 9, 59))).toBe(false);
    expect(isPastGrace('2026-09-14T08:00', new Date(2026, 8, 14, 10, 1))).toBe(true);
  });

  it('allows marking from an hour before until the grace window ends', () => {
    expect(isActionable('2026-09-14T08:00', new Date(2026, 8, 14, 6, 30))).toBe(false);
    expect(isActionable('2026-09-14T08:00', new Date(2026, 8, 14, 7, 0))).toBe(true);
    expect(isActionable('2026-09-14T08:00', new Date(2026, 8, 14, 9, 30))).toBe(true);
    expect(isActionable('2026-09-14T08:00', new Date(2026, 8, 14, 11, 0))).toBe(false);
  });

  it('describes times and days in words', () => {
    expect(describeTimes(['08:00', '14:30', '20:00'])).toBe('8:00 AM, 2:30 PM and 8:00 PM');
    expect(describeTimes(['09:00'])).toBe('9:00 AM');
    expect(describeDays(BASE)).toBe('Every day');
    expect(describeDays({ frequency: 'SPECIFIC_DAYS', days: [1, 3, 5] })).toBe('Mon, Wed and Fri');
    expect(describeDays({ frequency: 'SPECIFIC_DAYS', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
  });
});
