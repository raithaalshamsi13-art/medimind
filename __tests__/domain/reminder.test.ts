import {
  buildNotificationPlan,
  dateKeysBetween,
  describeDays,
  describeTimes,
  isActionable,
  isPastGrace,
  occurrencesOn,
  PLAN_HORIZON_DAYS,
  PLAN_MAX_DATED,
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

describe('buildNotificationPlan — what the OS is asked to schedule', () => {
  const NOW = new Date(2026, 9, 16, 9, 30); // Fri 16 Oct 2026, 09:30 local

  it('uses repeating daily triggers for an open-ended daily reminder', () => {
    const plan = buildNotificationPlan(BASE, NOW);
    expect(plan).toEqual([
      { kind: 'daily', hour: 8, minute: 0, time: '08:00' },
      { kind: 'daily', hour: 20, minute: 0, time: '20:00' },
    ]);
  });

  it('uses repeating weekly triggers per chosen day, with the OS weekday numbering (1 = Sunday)', () => {
    const plan = buildNotificationPlan({ ...BASE, times: ['09:00'], frequency: 'SPECIFIC_DAYS', days: [1, 5] }, NOW);
    expect(plan).toEqual([
      { kind: 'weekly', weekday: 2, hour: 9, minute: 0, time: '09:00' },
      { kind: 'weekly', weekday: 6, hour: 9, minute: 0, time: '09:00' },
    ]);
  });

  it('schedules nothing for a disabled reminder or one with no times', () => {
    expect(buildNotificationPlan({ ...BASE, enabled: false }, NOW)).toEqual([]);
    expect(buildNotificationPlan({ ...BASE, times: [] }, NOW)).toEqual([]);
  });

  it('turns a dated course into one notification per future occurrence, earliest first', () => {
    const plan = buildNotificationPlan({ ...BASE, startDate: '2026-10-16', endDate: '2026-10-18' }, NOW);
    // 16th 08:00 is already past at 09:30; 16th 20:00, then 17th and 18th twice each.
    expect(plan.map((p) => (p.kind === 'date' ? `${p.at.getDate()} ${p.time}` : p.kind))).toEqual([
      '16 20:00',
      '17 08:00',
      '17 20:00',
      '18 08:00',
      '18 20:00',
    ]);
    expect(plan.every((p) => p.kind === 'date')).toBe(true);
  });

  it('makes a one-time reminder from a start date equal to the end date', () => {
    const plan = buildNotificationPlan({ ...BASE, times: ['18:00'], startDate: '2026-10-20', endDate: '2026-10-20' }, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.kind).toBe('date');
    expect(plan[0]?.kind === 'date' && plan[0].at.getHours()).toBe(18);
    expect(plan[0]?.kind === 'date' && plan[0].at.getDate()).toBe(20);
  });

  it('schedules nothing once the end date has passed, and nothing before the start date', () => {
    expect(buildNotificationPlan({ ...BASE, endDate: '2026-10-15' }, NOW)).toEqual([]);
    const later = buildNotificationPlan({ ...BASE, times: ['08:00'], startDate: '2026-10-25' }, NOW);
    expect(later.every((p) => p.kind === 'date' && p.at.getDate() >= 25)).toBe(true);
    expect(later.length).toBeGreaterThan(0);
  });

  it('respects the two-week horizon and the per-reminder cap for dated plans', () => {
    const plan = buildNotificationPlan({ ...BASE, times: ['06:00', '12:00', '18:00'], startDate: '2026-10-01', endDate: '2027-01-01' }, NOW);
    expect(plan.length).toBeLessThanOrEqual(PLAN_MAX_DATED);
    const last = plan[plan.length - 1];
    expect(last?.kind === 'date' && last.at.getTime() <= NOW.getTime() + (PLAN_HORIZON_DAYS + 1) * 86_400_000).toBe(true);
  });
});
