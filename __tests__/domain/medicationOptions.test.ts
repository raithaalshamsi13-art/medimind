/**
 * The structured form controls must produce text the rest of the app already
 * understands, and must read that text back so editing pre-selects the same
 * chips. Anything unrecognised is kept verbatim — never rewritten.
 */

import { parseFrequency } from '@/domain/dosing';
import {
  composeDosage,
  composeFrequency,
  composeInstructions,
  DOSAGE_UNITS,
  FREQUENCY_PRESETS,
  isValidDoseAmount,
  isValidEveryHours,
  parseDosage,
  parseFrequencyChoice,
  parseInstructions,
} from '@/domain/medicationOptions';

describe('dosage', () => {
  it('composes amount + unit into the stored wording', () => {
    expect(composeDosage('500', 'mg')).toBe('500 mg');
    expect(composeDosage(' 2.5 ', 'ml')).toBe('2.5 ml');
    expect(composeDosage('1,5', 'g')).toBe('1.5 g');
  });

  it('pluralises count units', () => {
    expect(composeDosage('1', 'tablet')).toBe('1 tablet');
    expect(composeDosage('2', 'tablet')).toBe('2 tablets');
    expect(composeDosage('0.5', 'tablet')).toBe('0.5 tablets');
    expect(composeDosage('2', 'puff')).toBe('2 puffs');
  });

  it('stores nothing when the amount is blank', () => {
    expect(composeDosage('', 'mg')).toBeNull();
    expect(composeDosage('   ', 'tablet')).toBeNull();
  });

  it('round-trips every unit through parseDosage', () => {
    for (const unit of DOSAGE_UNITS) {
      const text = composeDosage('2', unit);
      expect(parseDosage(text)).toEqual({ amount: '2', unit });
      expect(parseDosage(composeDosage('1', unit))).toEqual({ amount: '1', unit });
    }
  });

  it('is case-insensitive on the unit', () => {
    expect(parseDosage('500 MG')).toEqual({ amount: '500', unit: 'mg' });
    expect(parseDosage('10mcg')).toEqual({ amount: '10', unit: 'mcg' });
  });

  it('refuses to guess for wording that is not amount + known unit', () => {
    expect(parseDosage('1 sachet in water')).toBeNull();
    expect(parseDosage('500 mg twice')).toBeNull();
    expect(parseDosage('two tablets')).toBeNull();
    expect(parseDosage(null)).toBeNull();
    expect(parseDosage('')).toBeNull();
  });

  it('validates the amount as a number', () => {
    expect(isValidDoseAmount('500')).toBe(true);
    expect(isValidDoseAmount('2.5')).toBe(true);
    expect(isValidDoseAmount('1/2')).toBe(true);
    expect(isValidDoseAmount('five')).toBe(false);
    expect(isValidDoseAmount('5 mg')).toBe(false);
    expect(isValidDoseAmount('')).toBe(false);
  });
});

describe('frequency', () => {
  it('every fixed preset composes to wording parseFrequency understands', () => {
    const expectedTimes: Record<string, number> = {
      ONCE_DAILY: 1,
      TWICE_DAILY: 2,
      THREE_TIMES_DAILY: 3,
      FOUR_TIMES_DAILY: 4,
    };
    for (const [preset, count] of Object.entries(expectedTimes)) {
      const text = composeFrequency({ preset: preset as never, hours: '', custom: '' });
      expect(text).not.toBeNull();
      const schedule = parseFrequency(text);
      expect(schedule?.times).toHaveLength(count);
    }
  });

  it('"as needed" composes to a schedule with no fixed times', () => {
    const text = composeFrequency({ preset: 'AS_NEEDED', hours: '', custom: '' });
    expect(parseFrequency(text)?.asNeeded).toBe(true);
  });

  it('"every N hours" needs a whole number from 1 to 24', () => {
    expect(composeFrequency({ preset: 'EVERY_HOURS', hours: '8', custom: '' })).toBe(
      'Every 8 hours',
    );
    expect(parseFrequency('Every 8 hours')?.times).toHaveLength(3);
    expect(composeFrequency({ preset: 'EVERY_HOURS', hours: '', custom: '' })).toBeNull();
    expect(composeFrequency({ preset: 'EVERY_HOURS', hours: '0', custom: '' })).toBeNull();
    expect(composeFrequency({ preset: 'EVERY_HOURS', hours: '30', custom: '' })).toBeNull();
    expect(isValidEveryHours('1.5')).toBe(false);
  });

  it('keeps custom wording verbatim', () => {
    expect(composeFrequency({ preset: 'OTHER', hours: '', custom: ' Every Monday ' })).toBe(
      'Every Monday',
    );
    expect(composeFrequency({ preset: 'OTHER', hours: '', custom: '  ' })).toBeNull();
    expect(composeFrequency({ preset: null, hours: '', custom: 'ignored' })).toBeNull();
  });

  it('reads stored text back into the same preset', () => {
    for (const preset of FREQUENCY_PRESETS) {
      if (preset === 'EVERY_HOURS' || preset === 'OTHER') continue;
      const text = composeFrequency({ preset, hours: '', custom: '' });
      expect(parseFrequencyChoice(text).preset).toBe(preset);
    }
    expect(parseFrequencyChoice('twice daily').preset).toBe('TWICE_DAILY');
    expect(parseFrequencyChoice('Every 6 hours')).toEqual({
      preset: 'EVERY_HOURS',
      hours: '6',
      custom: '',
    });
  });

  it('treats unrecognised text (e.g. from a scan) as custom, unchanged', () => {
    expect(parseFrequencyChoice('Two tablets at night')).toEqual({
      preset: 'OTHER',
      hours: '',
      custom: 'Two tablets at night',
    });
    expect(parseFrequencyChoice(null).preset).toBeNull();
    expect(parseFrequencyChoice('').preset).toBeNull();
  });
});

describe('instructions', () => {
  it('joins chips in list order and appends free text', () => {
    expect(composeInstructions(['At bedtime', 'With food'], '')).toBe('With food. At bedtime');
    expect(composeInstructions(['With food'], ' Avoid grapefruit ')).toBe(
      'With food. Avoid grapefruit',
    );
    expect(composeInstructions([], 'Shake well')).toBe('Shake well');
    expect(composeInstructions([], '   ')).toBeNull();
  });

  it('ignores values that are not real options', () => {
    expect(composeInstructions(['Not an option'], '')).toBeNull();
  });

  it('reads its own output back into chips + free text', () => {
    const text = composeInstructions(['With food', 'Do not crush or chew'], 'Avoid grapefruit');
    expect(parseInstructions(text)).toEqual({
      selected: ['With food', 'Do not crush or chew'],
      extra: 'Avoid grapefruit',
    });
  });

  it('keeps label text that never came from chips', () => {
    expect(parseInstructions('Take two with water every morning')).toEqual({
      selected: [],
      extra: 'Take two with water every morning',
    });
    expect(parseInstructions(null)).toEqual({ selected: [], extra: '' });
  });

  it('matches chips case-insensitively and drops a trailing full stop', () => {
    expect(parseInstructions('with food. at bedtime.')).toEqual({
      selected: ['With food', 'At bedtime'],
      extra: '',
    });
  });
});
