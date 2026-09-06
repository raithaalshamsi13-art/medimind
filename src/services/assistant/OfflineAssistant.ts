/**
 * Rule-based assistant that runs entirely on the device.
 *
 * WHY IT EXISTS
 * Demo mode must work with no internet and no API key, and an assistant that
 * silently fails when offline would be a bad experience in a medication app.
 * This implementation answers the questions the app can answer *from its own
 * records* — expiry, dosage, frequency, instructions, missed doses — by reading
 * those records back in plain language. It never infers anything medical.
 *
 * Because it is deterministic, every reply here is unit-tested, which is more
 * than can be said for a language model.
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { AssistantReply, MedicationContext } from '@/domain/assistant';
import { formatIsoDate, isoToday } from '@/lib/datetime';
import { ok, type Result } from '@/lib/result';

import type { AssistantRequest, AssistantService } from './AssistantService';

type Intent =
  | 'help'
  | 'list'
  | 'expiry'
  | 'dosage'
  | 'frequency'
  | 'instructions'
  | 'missed'
  | 'unknown';

function detectIntent(q: string): Intent {
  if (/\b(miss(ed|ing)?|forgot|forgotten|skipped|late (dose|taking))\b/.test(q)) return 'missed';
  if (/expir|out of date|use.by|best before/.test(q)) return 'expiry';
  if (/\b(dose|dosage|dosing|strength|how much|how many mg|milligram)\b/.test(q)) return 'dosage';
  if (/\b(how often|how many times|times a day|frequency|when (do|should) i take)\b/.test(q)) {
    return 'frequency';
  }
  if (
    /\b(instruction|direction|how (do|should) i take|with food|before (food|meal|eating)|after (food|meal|eating)|with water)\b/.test(
      q,
    )
  ) {
    return 'instructions';
  }
  if (
    /\b(what (medicines|medications|meds|drugs)|list|which medicines|my medicines|my medications|do i have)\b/.test(
      q,
    )
  ) {
    return 'list';
  }
  if (/\b(help|what can you|who are you|what do you do)\b/.test(q)) return 'help';
  return 'unknown';
}

/**
 * Find the saved medicine a question refers to. Matches the full name, or its
 * first word when that word is distinctive (4+ letters), preferring the
 * longest match so "Paracetamol Plus" beats "Paracetamol".
 */
function findMentioned(q: string, medications: MedicationContext[]): MedicationContext | null {
  let best: MedicationContext | null = null;
  let bestLength = 0;

  for (const medication of medications) {
    const full = medication.name.toLowerCase();
    const first = full.split(/\s+/)[0] ?? full;
    const candidates = first.length >= 4 ? [full, first] : [full];

    for (const candidate of candidates) {
      if (q.includes(candidate) && candidate.length > bestLength) {
        best = medication;
        bestLength = candidate.length;
      }
    }
  }
  return best;
}

function listNames(medications: MedicationContext[]): string {
  const names = medications.map((m) => m.name);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function describeExpiry(m: MedicationContext): string {
  if (!m.expirationDate) {
    return (
      `The expiry date for ${m.name} is not recorded. Check the box or bottle — it is ` +
      `usually printed as "EXP" followed by a month and year. You can add it by editing the medicine.`
    );
  }

  const days = differenceInCalendarDays(parseISO(m.expirationDate), parseISO(isoToday()));
  const pretty = formatIsoDate(m.expirationDate);

  if (days < 0) {
    return (
      `The expiry date you recorded for ${m.name} was ${pretty}, which has already passed. ` +
      `Please do not use it until you have checked with a pharmacist.`
    );
  }
  if (days === 0) {
    return `${m.name} expires today (${pretty}). It is worth checking with a pharmacist before using it.`;
  }
  if (days <= 30) {
    return (
      `${m.name} expires on ${pretty} — that is in ${days} day${days === 1 ? '' : 's'}, ` +
      `so it is worth planning a replacement.`
    );
  }
  return `${m.name} expires on ${pretty}, about ${days} days from now.`;
}

function describeField(
  m: MedicationContext,
  field: 'dosage' | 'frequency' | 'instructions',
): string {
  const labels = {
    dosage: 'a dosage',
    frequency: 'how often to take it',
    instructions: 'instructions',
  };
  const value = m[field];

  if (!value) {
    return (
      `You have not recorded ${labels[field]} for ${m.name}, and I will not guess it. ` +
      `Check the label or the leaflet in the box — or ask your pharmacist — and you can add it ` +
      `by editing the medicine.`
    );
  }
  switch (field) {
    case 'dosage':
      return `For ${m.name} you recorded a dosage of ${value}.`;
    case 'frequency':
      return `For ${m.name} you recorded: ${value}.`;
    case 'instructions':
      return `The instructions you recorded for ${m.name} are: "${value}".`;
  }
}

const MISSED_DOSE_REPLY =
  'If you have missed a dose, do not take a double dose to make up for it. Check the label or ' +
  'the leaflet that came with the medicine — many say to take the missed dose when you remember ' +
  'unless it is nearly time for the next one, but this varies. If you are unsure, your pharmacist ' +
  'can tell you what to do for that specific medicine.';

const HELP_REPLY =
  'I can answer questions about the medicines you have saved in MediMind: when they expire, ' +
  'what dosage, frequency and instructions you recorded, and what to do if you miss a dose. ' +
  'I cannot tell you whether a medicine is right for you, how much to take, or whether medicines ' +
  'can be taken together — a pharmacist or doctor is the right person for those questions.';

export class OfflineAssistant implements AssistantService {
  readonly kind = 'offline' as const;

  async ask(request: AssistantRequest): Promise<Result<AssistantReply>> {
    return ok({ text: this.answer(request), source: 'offline' });
  }

  /** Exposed for tests: a pure function from request to reply text. */
  answer({ question, medications }: AssistantRequest): string {
    const q = question.trim().toLowerCase();
    const intent = detectIntent(q);
    const mentioned = findMentioned(q, medications);

    if (intent === 'help') return HELP_REPLY;
    if (intent === 'missed') return MISSED_DOSE_REPLY;

    if (medications.length === 0) {
      return (
        'You have not saved any medicines yet, so there is nothing for me to look up. ' +
        'Add one from the Medicines tab and I can answer questions about it.'
      );
    }

    if (intent === 'list') {
      const count = medications.length;
      return `You have ${count} medicine${count === 1 ? '' : 's'} saved: ${listNames(medications)}.`;
    }

    if (intent === 'expiry') {
      if (mentioned) return describeExpiry(mentioned);

      const dated = medications
        .filter((m) => m.expirationDate)
        .sort((a, b) => (a.expirationDate ?? '').localeCompare(b.expirationDate ?? ''));
      const undated = medications.filter((m) => !m.expirationDate);

      if (dated.length === 0) {
        return (
          `None of your saved medicines has an expiry date recorded yet (${listNames(medications)}). ` +
          `Check each box or bottle for "EXP" and add the dates by editing the medicine.`
        );
      }
      let reply = `The soonest to expire is ${dated[0].name}. ${describeExpiry(dated[0])}`;
      if (dated.length > 1) {
        const rest = dated
          .slice(1)
          .map((m) => `${m.name} (${formatIsoDate(m.expirationDate ?? '')})`)
          .join(', ');
        reply += ` After that: ${rest}.`;
      }
      if (undated.length > 0) {
        reply += ` I do not have an expiry date for ${listNames(undated)}.`;
      }
      return reply;
    }

    if (intent === 'dosage' || intent === 'frequency' || intent === 'instructions') {
      if (mentioned) return describeField(mentioned, intent);
      if (medications.length === 1) return describeField(medications[0], intent);
      return (
        `Which medicine do you mean? Your saved medicines are ${listNames(medications)}. ` +
        `Ask me about one of them by name.`
      );
    }

    // Unknown intent, but a medicine was named — summarise what is recorded.
    if (mentioned) {
      const parts = [
        mentioned.dosage ? `dosage ${mentioned.dosage}` : null,
        mentioned.frequency ? `taken ${mentioned.frequency.toLowerCase()}` : null,
        mentioned.expirationDate
          ? `expires ${formatIsoDate(mentioned.expirationDate)}`
          : 'no expiry date recorded',
      ].filter(Boolean);
      return (
        `Here is what you recorded for ${mentioned.name}: ${parts.join(', ')}. ` +
        `You can ask me about its expiry, dosage, or instructions.`
      );
    }

    return (
      'I am not sure how to help with that. I can answer questions about your saved medicines — ' +
      `for example "When does ${medications[0].name} expire?" or ` +
      `"What dosage did I record for ${medications[0].name}?"`
    );
  }
}
