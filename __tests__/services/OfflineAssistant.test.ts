/**
 * The offline assistant is deterministic, so every kind of answer it can give
 * is pinned down here — including the ones that matter most: it must never
 * invent a value that was not recorded, and it must never suggest taking more.
 */

import { toMedicationContext, type MedicationContext } from '@/domain/assistant';
import type { Medication } from '@/domain/medication';
import { OfflineAssistant } from '@/services/assistant/OfflineAssistant';

const assistant = new OfflineAssistant();

/** Build a context the way the store does, at a fixed "now" (10:00 local). */
function ctx(partial: Partial<Medication> & { name: string }): MedicationContext {
  const medication: Medication = {
    id: 'm',
    userId: 'u',
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
    ...partial,
  };
  return toMedicationContext(medication, new Date(2026, 8, 6, 10, 0, 0));
}

const PARACETAMOL = ctx({
  name: 'Paracetamol',
  dosage: '500 mg',
  frequency: 'Twice daily',
  instructions: 'Take with food',
  expirationDate: '2099-04-30',
});

const MYSTERY = ctx({ name: 'Mystery tablets' });

const EXPIRED = ctx({ name: 'Old ibuprofen', dosage: '200 mg', expirationDate: '2020-01-01' });

const PRN = ctx({ name: 'Antihistamine', dosage: '10 mg', frequency: 'as needed' });

function answer(question: string, medications: MedicationContext[] = [PARACETAMOL]) {
  return assistant.answer({ question, history: [], medications });
}

describe('OfflineAssistant', () => {
  it('reports its kind as offline', async () => {
    const result = await assistant.ask({ question: 'help', history: [], medications: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.source).toBe('offline');
    expect(assistant.kind).toBe('offline');
  });

  describe('next dose — the label read back, with a time worked out', () => {
    it('tells the patient the next dose time, amount and instructions', () => {
      const reply = answer('when is my next dose of paracetamol?');
      expect(reply).toContain('next dose of Paracetamol is at 8:00 PM today');
      expect(reply).toContain('500 mg');
      expect(reply).toContain('Take with food');
      expect(reply).toContain('twice daily');
    });

    it('answers "what do I take now" the same way', () => {
      expect(answer('what do I take now?')).toContain('8:00 PM today');
    });

    it('says the amount is not recorded rather than inventing one', () => {
      const reply = answer('when is my next dose', [ctx({ name: 'Vitamin D', frequency: 'once daily' })]);
      expect(reply).toContain('8:00 AM tomorrow');
      expect(reply).toContain('amount is not recorded');
      expect(reply).not.toMatch(/\d+\s?mg/i);
    });

    it('refuses to work out a time when the frequency is not recorded', () => {
      const reply = answer('when is my next dose of mystery tablets', [MYSTERY]);
      expect(reply).toContain('how often to take it is not recorded');
      expect(reply).not.toMatch(/\d{1,2}:\d{2}/);
    });

    it('refuses to guess when the frequency wording is not understood', () => {
      const reply = answer('next dose?', [ctx({ name: 'Drops', frequency: 'as directed', dosage: '2 drops' })]);
      expect(reply).toContain('could not turn that into fixed times');
      expect(reply).toContain('will not guess');
    });

    it('explains an as-needed medicine has no fixed time and does not state a limit', () => {
      const reply = answer('when do I take antihistamine', [PRN]);
      expect(reply).toContain('as needed');
      expect(reply).toContain('10 mg');
      expect(reply).not.toMatch(/maximum|up to|no more than/i);
    });

    it('lists next doses across all medicines when none is named', () => {
      const reply = answer("what are today's doses?", [PARACETAMOL, PRN, MYSTERY]);
      expect(reply).toContain('Paracetamol at 8:00 PM today (500 mg)');
      expect(reply).toContain('Antihistamine and Mystery tablets: no fixed time');
    });
  });

  describe('expiry', () => {
    it('reads back a future expiry date', () => {
      const reply = answer('When does paracetamol expire?');
      expect(reply).toContain('Paracetamol');
      expect(reply).toContain('30 Apr 2099');
    });

    it('warns clearly when the recorded date has passed', () => {
      const reply = answer('has my old ibuprofen expired?', [EXPIRED]);
      expect(reply).toContain('already passed');
      expect(reply).toContain('pharmacist');
    });

    it('says when no expiry date was recorded, instead of guessing one', () => {
      const reply = answer('when do my mystery tablets expire', [MYSTERY]);
      expect(reply).toContain('not recorded');
      expect(reply).not.toMatch(/\d{4}/);
    });

    it('finds the soonest expiry across all medicines', () => {
      const reply = answer('Which of my medicines expires first?', [PARACETAMOL, EXPIRED, MYSTERY]);
      expect(reply).toContain('Old ibuprofen');
      expect(reply).toContain('Mystery tablets');
    });
  });

  describe('recorded fields', () => {
    it('reads back the dosage with its schedule and instructions', () => {
      const reply = answer('how much paracetamol do I take?');
      expect(reply).toContain('500 mg');
      expect(reply).toContain('twice daily');
      expect(reply).toContain('Take with food');
      expect(reply).toContain('exactly as the label says');
    });

    it('reads back the frequency', () => {
      expect(answer('how often do I take paracetamol?')).toContain('Twice daily');
    });

    it('reads back the instructions', () => {
      expect(answer('how should I take paracetamol?')).toContain('Take with food');
    });

    it('refuses to guess a dosage that was never recorded', () => {
      const reply = answer('what dose of mystery tablets should I take', [MYSTERY]);
      expect(reply).toContain('will not guess');
      expect(reply).not.toMatch(/\d+\s?mg/i);
    });

    it('asks which medicine when several are saved and none is named', () => {
      const reply = answer('what is my dosage?', [PARACETAMOL, EXPIRED]);
      expect(reply).toContain('Which medicine');
      expect(reply).toContain('Paracetamol');
      expect(reply).toContain('Old ibuprofen');
    });
  });

  describe('missed dose', () => {
    it('never suggests doubling up', () => {
      const reply = answer('I forgot to take my paracetamol this morning');
      expect(reply).toContain('do not take a double dose');
      expect(reply).toContain('pharmacist');
    });
  });

  describe('listing and help', () => {
    it('lists saved medicines', () => {
      const reply = answer('what medicines do I have?', [PARACETAMOL, MYSTERY]);
      expect(reply).toContain('2 medicines');
      expect(reply).toContain('Paracetamol and Mystery tablets');
    });

    it('explains its limits when asked for help', () => {
      const reply = answer('what can you help me with?', []);
      expect(reply).toContain('whether to take more or less than the label says');
    });

    it('handles having no medicines saved', () => {
      expect(answer('when does anything expire?', [])).toContain('not saved any medicines');
    });

    it('gives an example question when it does not understand', () => {
      const reply = answer('tell me a joke');
      expect(reply).toContain('When is my next dose of Paracetamol?');
    });
  });
});
