/**
 * Dose scheduling — derived strictly from recorded frequency text.
 *
 * The most important cases are the negative ones: wording that is not
 * understood must produce `null`, never a default schedule. A made-up schedule
 * for a real medicine is exactly the invention MediMind forbids.
 */

import { nextDose, parseFrequency } from '@/domain/dosing';

describe('parseFrequency', () => {
  it.each([
    ['once daily', ['08:00'], 'once daily'],
    ['Once a day', ['08:00'], 'once daily'],
    ['daily', ['08:00'], 'once daily'],
    ['every day', ['08:00'], 'once daily'],
    ['twice daily', ['08:00', '20:00'], 'twice daily'],
    ['Twice a day', ['08:00', '20:00'], 'twice daily'],
    ['2 times a day', ['08:00', '20:00'], '2 times daily'],
    ['2x daily', ['08:00', '20:00'], '2 times daily'],
    ['three times daily', ['08:00', '14:00', '20:00'], '3 times daily'],
    ['3 times per day', ['08:00', '14:00', '20:00'], '3 times daily'],
    ['four times a day', ['08:00', '12:00', '16:00', '20:00'], '4 times daily'],
    ['every 8 hours', ['00:00', '08:00', '16:00'], 'every 8 hours'],
    ['every 12 hours', ['08:00', '20:00'], 'every 12 hours'],
    ['every six hours', ['02:00', '08:00', '14:00', '20:00'], 'every 6 hours'],
    ['BID', ['08:00', '20:00'], 'twice daily'],
    ['TID', ['08:00', '14:00', '20:00'], '3 times daily'],
  ])('understands "%s"', (text, times, description) => {
    const s = parseFrequency(text);
    expect(s).not.toBeNull();
    expect(s?.asNeeded).toBe(false);
    expect(s?.times).toEqual(times);
    expect(s?.description).toBe(description);
  });

  it('maps parts of the day to sensible clock times', () => {
    expect(parseFrequency('morning and evening')?.times).toEqual(['08:00', '18:00']);
    expect(parseFrequency('at bedtime')?.times).toEqual(['21:00']);
    expect(parseFrequency('every morning')?.times).toEqual(['08:00']);
    expect(parseFrequency('with lunch')?.times).toEqual(['13:00']);
  });

  it('treats "as needed" as having no fixed times', () => {
    for (const text of ['as needed', 'when required', 'PRN', 'take if needed for pain']) {
      const s = parseFrequency(text);
      expect(s?.asNeeded).toBe(true);
      expect(s?.times).toEqual([]);
    }
  });

  it.each([
    null,
    undefined,
    '',
    '   ',
    'see leaflet',
    'as directed by your doctor',
    'every 7 hours', // does not divide the day evenly — refuse rather than guess
    '13 times a day', // implausible — refuse
  ])('returns null rather than guessing for %p', (text) => {
    expect(parseFrequency(text as string | null | undefined)).toBeNull();
  });
});

describe('nextDose', () => {
  const twiceDaily = parseFrequency('twice daily');
  if (!twiceDaily) throw new Error('fixture failed');

  const at = (h: number, m = 0) => {
    const d = new Date(2026, 8, 6, h, m, 0, 0); // 6 Sep 2026, local time
    return d;
  };

  it('finds the next dose later today', () => {
    const next = nextDose(twiceDaily, at(10));
    expect(next?.time).toBe('20:00');
    expect(next?.isTomorrow).toBe(false);
    expect(next?.isDueNow).toBe(false);
  });

  it('rolls over to tomorrow after the last dose', () => {
    const next = nextDose(twiceDaily, at(21));
    expect(next?.time).toBe('08:00');
    expect(next?.isTomorrow).toBe(true);
    expect(next?.at.getDate()).toBe(7);
  });

  it('reports "due now" within 30 minutes either side', () => {
    expect(nextDose(twiceDaily, at(7, 45))?.isDueNow).toBe(true);
    expect(nextDose(twiceDaily, at(8, 20))?.isDueNow).toBe(true);
    expect(nextDose(twiceDaily, at(8, 45))?.isDueNow).toBe(false);
  });

  it('has no next dose for an as-needed medicine', () => {
    const prn = parseFrequency('as needed');
    if (!prn) throw new Error('fixture failed');
    expect(nextDose(prn, at(10))).toBeNull();
  });
});
