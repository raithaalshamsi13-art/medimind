/**
 * The safety screen runs before ANY assistant — offline or AI — sees a
 * question. These tests are the contract: dangerous questions get a fixed,
 * conservative reply and never reach a model, while questions that only ask
 * for the label to be read back are allowed through.
 */

import {
  HIGH_RISK_REPLIES,
  screenQuestion,
  suggestedQuestionsFor,
  toMedicationContext,
  toPersonContext,
} from '@/domain/assistant';
import type { Medication } from '@/domain/medication';

describe('screenQuestion', () => {
  it.each([
    ['I have chest pain after taking it', 'emergency'],
    ['my dad took too many pills what do I do', 'emergency'],
    ['can I double my dose tonight', 'dosing'],
    ['should I take an extra tablet', 'dosing'],
    ['can I stop taking paracetamol', 'dosing'],
    ['how many can I take in a day', 'none'],
    ['what is the maximum dose', 'none'],
    ['can I take more than the label says', 'dosing'],
    ['can I take ibuprofen and paracetamol together', 'interaction'],
    ['is it ok with alcohol', 'interaction'],
    ['is paracetamol safe in pregnancy', 'population'],
    ['can I give this to my child', 'population'],
  ])('flags "%s" as %s', (question, reason) => {
    expect(screenQuestion(question)).toEqual({ level: 'high', reason });
  });

  it('puts emergencies ahead of everything else', () => {
    // Mentions a dose AND an emergency — emergency must win.
    expect(screenQuestion('I doubled my dose and now I cannot breathe')).toEqual({
      level: 'high',
      reason: 'emergency',
    });
  });

  it.each([
    'when does paracetamol expire?',
    'what dosage did I record for ibuprofen?',
    'how much paracetamol do I take?',
    'what is my dose?',
    'when is my next dose?',
    'what do I take now?',
    'how often do I take it?',
    'what should I do if I miss a dose?',
    'what can you help with',
  ])('lets a read-the-label question through: "%s"', (question) => {
    expect(screenQuestion(question)).toEqual({ level: 'none' });
  });

  it('has a fixed reply for every reason, each pointing to a professional', () => {
    for (const reply of Object.values(HIGH_RISK_REPLIES)) {
      expect(reply).toMatch(/pharmacist|doctor|emergency/i);
    }
    expect(HIGH_RISK_REPLIES.emergency).toMatch(/emergency services/i);
  });
});

describe('toMedicationContext', () => {
  const medication: Medication = {
    id: 'm1',
    userId: 'u1',
    memberId: null,
    name: 'Paracetamol',
    kind: null,
    form: null,
    conditionIds: [],
    dosage: '500 mg',
    instructions: 'Take with food',
    expirationDate: '2027-04-30',
    frequency: 'Twice daily',
    safetyStatus: 'UNKNOWN',
    source: 'SCAN',
    scanConfidence: 0.9,
    notes: 'private note',
    imageUri: 'file:///label.jpg',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('shares only label facts — no ids, notes, photos or account data', () => {
    const context = toMedicationContext(medication, new Date(2026, 8, 6, 10, 0, 0));
    expect(Object.keys(context).sort()).toEqual(
      ['dosage', 'expirationDate', 'frequency', 'instructions', 'name', 'nextDoseLabel', 'schedule'].sort(),
    );
    expect(JSON.stringify(context)).not.toContain('private note');
    expect(JSON.stringify(context)).not.toContain('label.jpg');
  });

  it('derives the schedule and next dose from the recorded frequency', () => {
    const context = toMedicationContext(medication, new Date(2026, 8, 6, 10, 0, 0));
    expect(context.schedule?.times).toEqual(['08:00', '20:00']);
    expect(context.nextDoseLabel).toBe('8:00 PM today');
  });

  it('marks a dose as "now" inside the 30-minute window', () => {
    const context = toMedicationContext(medication, new Date(2026, 8, 6, 19, 50, 0));
    expect(context.nextDoseLabel).toBe('8:00 PM — that is now');
  });

  it('gives no schedule when the frequency is missing or unreadable', () => {
    expect(toMedicationContext({ ...medication, frequency: null }).schedule).toBeNull();
    expect(toMedicationContext({ ...medication, frequency: 'see leaflet' }).schedule).toBeNull();
    expect(toMedicationContext({ ...medication, frequency: null }).nextDoseLabel).toBeNull();
  });
});

describe('suggestedQuestionsFor', () => {
  it('names the medicine in each suggestion', () => {
    for (const q of suggestedQuestionsFor('Aspirin')) expect(q).toContain('Aspirin');
  });
});

describe('toPersonContext', () => {
  const NOW = new Date(2026, 8, 13);
  const member = {
    id: 'f1',
    userId: 'u1',
    name: 'Fatima',
    relationship: 'MOTHER' as const,
    customRelationship: null,
    dateOfBirth: '1960-03-15',
    gender: 'FEMALE' as const,
    heightCm: 160,
    weightKg: 68.5,
    bloodType: 'O+' as const,
    avatarColor: 'info' as const,
    isSelf: false,
    profileSetupDone: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const conditions = [
    { id: 'c1', userId: 'u1', memberId: 'f1', type: 'HIGH_BLOOD_PRESSURE' as const, customName: null, reading: '130/85', notes: 'private', createdAt: '', updatedAt: '' },
    { id: 'c2', userId: 'u1', memberId: 'other', type: 'ASTHMA' as const, customName: null, reading: null, notes: null, createdAt: '', updatedAt: '' },
  ];

  it('describes a relative with age in years — never the date of birth, name or notes', () => {
    const person = toPersonContext(member, conditions, NOW);
    expect(person).toEqual({
      label: 'your mother',
      name: 'Fatima',
      isSelf: false,
      ageYears: 66,
      gender: 'Female',
      heightCm: 160,
      weightKg: 68.5,
      bloodType: 'O+',
      conditions: [{ name: 'High blood pressure', reading: '130/85' }],
    });
    expect(JSON.stringify(person)).not.toContain('1960');
    expect(JSON.stringify(person)).not.toContain('private');
  });

  it('only includes that member’s conditions, and hides "unspecified"/"unknown" choices', () => {
    const person = toPersonContext(
      { ...member, isSelf: true, relationship: 'ME', gender: 'UNSPECIFIED', bloodType: 'UNKNOWN', dateOfBirth: null },
      conditions,
      NOW,
    );
    expect(person.label).toBe('you');
    expect(person.gender).toBeNull();
    expect(person.bloodType).toBeNull();
    expect(person.ageYears).toBeNull();
    expect(person.conditions).toHaveLength(1);
  });
});
