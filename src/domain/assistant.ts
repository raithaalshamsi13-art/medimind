/**
 * The MediMind assistant — types, wording, and the safety screen.
 *
 * WHAT THE ASSISTANT IS
 * An informational helper that answers questions about the medicines the user
 * has saved: when they expire, what dosage or instructions were recorded, what
 * to do about a missed dose. It reads the user's own records back to them in
 * plain language.
 *
 * WHAT IT IS NOT
 * A doctor, a pharmacist, or a source of medical advice. Every reply is shown
 * with a note saying it may be wrong and that the user should check with a
 * professional, and the user must acknowledge that before first use.
 *
 * THE SAFETY SCREEN
 * `screenQuestion` runs on the device BEFORE any assistant (offline or AI)
 * sees a question. Anything about changing doses, mixing medicines, pregnancy,
 * children, or an emergency is answered with a fixed, conservative message and
 * never reaches a model. This is a hard rule in code, not a hope that the
 * model behaves.
 */

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
 * about the label.
 */
export type MedicationContext = {
  name: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  expirationDate: string | null;
};

export function toMedicationContext(medication: Medication): MedicationContext {
  return {
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    instructions: medication.instructions,
    expirationDate: medication.expirationDate,
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
  'when they expire or what dosage you recorded.\n\n' +
  'It is not a doctor or a pharmacist. It can misread your records or give a wrong answer, ' +
  'and it does not know your medical history.\n\n' +
  'Please do not depend on it. Never change how you take a medicine because of something the ' +
  'assistant said — follow the label, and follow up with your doctor or pharmacist.';

export const ASSISTANT_INTRO =
  'Hello! I can answer questions about the medicines you have saved in MediMind — for example ' +
  'when they expire, or what dosage and instructions you recorded. What would you like to know?';

export const SUGGESTED_QUESTIONS: readonly string[] = [
  'Which of my medicines expires first?',
  'What should I do if I miss a dose?',
  'What can you help me with?',
];

/** Questions tailored to one medicine, used when opened from its detail screen. */
export function suggestedQuestionsFor(name: string): readonly string[] {
  return [
    `When does ${name} expire?`,
    `What dosage did I record for ${name}?`,
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

const DOSING_PATTERNS = [
  /doubl(e|ing)/i,
  /extra (dose|tablet|pill)/i,
  /two doses/i,
  /(increase|decrease|raise|lower|change|reduce) (the |my )?dos/i,
  /how (many|much) (can|should|could) i take/i,
  /(can|should) i (stop|quit) taking/i,
  /stop taking/i,
  /take more/i,
];

const INTERACTION_PATTERNS = [
  /interact/i,
  /(take|mix|combine) .* (together|with each other)/i,
  /(with|and) alcohol/i,
  /safe to take .* with/i,
  /at the same time as/i,
];

const POPULATION_PATTERNS = [/pregnan/i, /breastfeed|breast-feed|nursing/i, /\b(child|children|baby|infant|toddler|kid)s?\b/i];

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
    'I cannot advise on how much of a medicine to take, or on stopping, increasing or doubling ' +
    'a dose — getting that wrong can be harmful. Please follow the instructions on the label, ' +
    'and speak to your pharmacist or doctor before making any change.',
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
