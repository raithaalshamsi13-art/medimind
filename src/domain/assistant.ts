/**
 * The MediMind assistant — types, wording, and the safety screen.
 *
 * WHAT THE ASSISTANT IS
 * An informational helper that answers questions about the medicines the user
 * has saved: when they expire, what dosage or instructions were recorded, what
 * their next scheduled dose is, what to do about a missed dose. It reads the
 * user's own records back to them in plain language and works out times from
 * the recorded frequency.
 *
 * WHAT IT IS NOT
 * A doctor, a pharmacist, or a source of medical advice. It never decides HOW
 * MUCH to take: the amount is whatever the user recorded from the label, or
 * "not recorded". Every reply is shown with a note saying it may be wrong and
 * that the user should check with a professional, and the user must
 * acknowledge that before first use.
 *
 * THE SAFETY SCREEN
 * `screenQuestion` runs on the device BEFORE any assistant (offline or AI)
 * sees a question. Anything about taking MORE than the label, stopping,
 * mixing medicines, pregnancy, children, or an emergency is answered with a
 * fixed, conservative message and never reaches a model. This is a hard rule
 * in code, not a hope that the model behaves.
 */

import { nextDose, parseFrequency, type DoseSchedule } from './dosing';
import type { Medication } from './medication';

export type AssistantRole = 'user' | 'assistant';

/** Which implementation produced a reply. Shown to the user. */
export type AssistantSource = 'offline' | 'ai';

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  text: string;
  /** Present on assistant messages only. */
  source?: AssistantSource;
  createdAt: string;
};

export type AssistantReply = {
  text: string;
  source: AssistantSource;
};

/** A prior turn, sent to the AI so it can follow a conversation. */
export type AssistantTurn = {
  role: AssistantRole;
  content: string;
};

/**
 * The ONLY medication facts ever shared with an assistant. No ids, no notes,
 * no photos, no account details — just what is needed to answer a question
 * about the label, plus the schedule the app derived from it.
 */
export type MedicationContext = {
  name: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  expirationDate: string | null;
  /**
   * Derived by `parseFrequency` from `frequency`; null when the wording was
   * not understood. Computed by the app so the AI never does the arithmetic.
   */
  schedule: DoseSchedule | null;
  /**
   * Human-readable next scheduled dose, e.g. "8:00 PM today" or "8:00 AM
   * tomorrow"; null when there is no fixed schedule.
   */
  nextDoseLabel: string | null;
};

function clockLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const hour12 = ((h ?? 0) + 11) % 12 + 1;
  const suffix = (h ?? 0) < 12 ? 'AM' : 'PM';
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

/** "8:00 PM" for "20:00". Exported for the offline assistant's wording. */
export function formatDoseTime(time: string): string {
  return clockLabel(time);
}

export function toMedicationContext(medication: Medication, now: Date = new Date()): MedicationContext {
  const schedule = parseFrequency(medication.frequency);
  const next = schedule ? nextDose(schedule, now) : null;

  let nextDoseLabel: string | null = null;
  if (next) {
    nextDoseLabel = next.isDueNow
      ? `${clockLabel(next.time)} — that is now`
      : `${clockLabel(next.time)} ${next.isTomorrow ? 'tomorrow' : 'today'}`;
  }

  return {
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    instructions: medication.instructions,
    expirationDate: medication.expirationDate,
    schedule,
    nextDoseLabel,
  };
}

export const MAX_QUESTION_LENGTH = 500;

/** Shown under every assistant reply, and in the banner above the chat. */
export const ASSISTANT_SAFETY_NOTE =
  'The assistant can make mistakes. Do not rely on it for decisions about your health — ' +
  'always check with your doctor or pharmacist.';

/** The one-line footer on each reply bubble. */
export const ASSISTANT_REPLY_FOOTER = 'May be wrong — check with your doctor or pharmacist.';

/** Read once, before first use. Deliberately plain and unhurried. */
export const ASSISTANT_ACKNOWLEDGEMENT =
  'The MediMind assistant can answer questions about the medicines you have saved, such as ' +
  'when they expire, what dosage you recorded, and when your next dose is due.\n\n' +
  'It only repeats what you recorded from your labels. It is not a doctor or a pharmacist. ' +
  'It can misread your records or give a wrong answer, and it does not know your medical ' +
  'history.\n\n' +
  'Please do not depend on it. Never change how much or how often you take a medicine ' +
  'because of something the assistant said — follow the label, and follow up with your ' +
  'doctor or pharmacist.';

export const ASSISTANT_INTRO =
  'Hello! I can answer questions about the medicines you have saved in MediMind — for example ' +
  'when your next dose is due, what dosage and instructions you recorded, or when a medicine ' +
  'expires. What would you like to know?';

export const SUGGESTED_QUESTIONS: readonly string[] = [
  'What is my next dose?',
  'Which of my medicines expires first?',
  'What should I do if I miss a dose?',
];

/** Questions tailored to one medicine, used when opened from its detail screen. */
export function suggestedQuestionsFor(name: string): readonly string[] {
  return [
    `When is my next dose of ${name}?`,
    `How much ${name} do I take?`,
    `How should I take ${name}?`,
  ];
}

// ---------------------------------------------------------------------------
// Safety screen
// ---------------------------------------------------------------------------

export type RiskReason = 'emergency' | 'dosing' | 'interaction' | 'population';

export type RiskScreen = { level: 'none' } | { level: 'high'; reason: RiskReason };

const EMERGENCY_PATTERNS = [
  /chest pain/i,
  /can'?t breathe|cannot breathe|trouble breathing|difficulty breathing/i,
  /unconscious|passed out|collapsed/i,
  /seizure|fitting/i,
  /allergic reaction|anaphyla/i,
  /overdos/i,
  /too many (pills|tablets)/i,
  /swallowed .* (whole (bottle|pack)|lots of)/i,
];

/**
 * Questions about taking MORE or LESS than the label, or stopping. Note that
 * "how much do I take" / "what is my dose" are NOT here: those are answered
 * by reading the recorded label back, which is allowed.
 */
const DOSING_PATTERNS = [
  /doubl(e|ing)/i,
  /(extra|another|additional|second) (dose|tablet|pill|one)/i,
  /two doses/i,
  /(increase|decrease|raise|lower|change|reduce|adjust) (the |my )?dos/i,
  /how (many|much) (can|could) i take/i,
  /(maximum|max|most) (dose|amount|i can take|number)/i,
  /(can|should) i (stop|quit) taking/i,
  /stop taking/i,
  /take more/i,
  /more than (the label|it says|recommended)/i,
];

const INTERACTION_PATTERNS = [
  /interact/i,
  /(take|mix|combine) .* (together|with each other)/i,
  /(with|and) alcohol/i,
  /safe to take .* with/i,
  /at the same time as/i,
];

const POPULATION_PATTERNS = [
  /pregnan/i,
  /breastfeed|breast-feed|nursing/i,
  /\b(child|children|baby|infant|toddler|kid)s?\b/i,
];

/**
 * Classify a question before answering it. Order matters: an emergency wins
 * over everything else.
 */
export function screenQuestion(question: string): RiskScreen {
  const q = question.trim();
  if (EMERGENCY_PATTERNS.some((p) => p.test(q))) return { level: 'high', reason: 'emergency' };
  if (DOSING_PATTERNS.some((p) => p.test(q))) return { level: 'high', reason: 'dosing' };
  if (INTERACTION_PATTERNS.some((p) => p.test(q))) return { level: 'high', reason: 'interaction' };
  if (POPULATION_PATTERNS.some((p) => p.test(q))) return { level: 'high', reason: 'population' };
  return { level: 'none' };
}

/** Fixed replies for screened questions. Conservative on purpose. */
export const HIGH_RISK_REPLIES: Record<RiskReason, string> = {
  emergency:
    'This sounds like it could be an emergency. Please contact your local emergency services ' +
    'or go to the nearest emergency department right away. I am not able to help with urgent ' +
    'medical situations.',
  dosing:
    'I cannot advise on taking more or less of a medicine than your label says, or on stopping ' +
    'it — getting that wrong can be harmful. I can only tell you what you recorded from the ' +
    'label. Please follow the label, and speak to your pharmacist or doctor before making any ' +
    'change.',
  interaction:
    'I cannot tell you whether medicines are safe to take together, or with alcohol. That ' +
    'depends on your health and history, which I do not know. A pharmacist can check this for ' +
    'you quickly — please ask them before combining anything.',
  population:
    'Questions about medicines during pregnancy, while breastfeeding, or for children need a ' +
    'professional answer, and I am not able to give one safely. Please ask your doctor, ' +
    'midwife or pharmacist.',
};

/** The standard closing line the AI is instructed to end every reply with. */
export const ASSISTANT_CLOSING_LINE =
  'Please check with your doctor or pharmacist before acting on this.';
