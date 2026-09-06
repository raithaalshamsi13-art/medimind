/**
 * The offline assistant is deterministic, so every kind of answer it can give
 * is pinned down here — including the ones that matter most: it must never
 * invent a value that was not recorded, and it must never suggest taking more.
 */

import type { MedicationContext } from '@/domain/assistant';
import { OfflineAssistant } from '@/services/assistant/OfflineAssistant';

const assistant = new OfflineAssistant();

const PARACETAMOL: MedicationContext = {
  name: 'Paracetamol',
  dosage: '500 mg',
  frequency: 'Twice daily',
  instructions: 'Take with food',
  expirationDate: '2099-04-30',
};

const MYSTERY: MedicationContext = {
  name: 'Mystery tablets',
  dosage: null,
  frequency: null,
  instructions: null,
  expirationDate: null,
};

const EXPIRED: MedicationContext = {
  name: 'Old ibuprofen',
  dosage: '200 mg',
  frequency: null,
  instructions: null,
  expirationDate: '2020-01-01',
};

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
    it('reads back the dosage', () => {
      expect(answer('what is my paracetamol dose?')).toContain('500 mg');
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
      expect(reply).toContain('cannot tell you whether a medicine is right for you');
    });

    it('handles having no medicines saved', () => {
      expect(answer('when does anything expire?', [])).toContain('not saved any medicines');
    });

    it('gives an example question when it does not understand', () => {
      const reply = answer('tell me a joke');
      expect(reply).toContain('When does Paracetamol expire?');
    });
  });
});
