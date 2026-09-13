/**
 * Conversation state for the assistant.
 *
 * Deliberately NOT persisted: a medication Q&A is sensitive, it is only useful
 * in the moment, and the least data we keep is the least that can leak. Close
 * the screen and the conversation is gone (Phase 18: minimal personal data).
 *
 * The safety screen is applied HERE, before any service is chosen, so that a
 * risky question gets the same fixed reply whether the offline assistant or
 * the AI would otherwise have answered.
 */

import { create } from 'zustand';

import {
  ASSISTANT_INTRO,
  HIGH_RISK_REPLIES,
  MAX_QUESTION_LENGTH,
  screenQuestion,
  toMedicationContext,
  type AssistantMessage,
  type AssistantSource,
  type AssistantTurn,
  type PersonContext,
} from '@/domain/assistant';
import type { Medication } from '@/domain/medication';
import { isoNow } from '@/lib/datetime';
import { customError, type AppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { getAssistantService } from '@/services/assistant';

type AssistantState = {
  messages: AssistantMessage[];
  isThinking: boolean;
  error: AppError | null;
  /** Which implementation answered most recently. */
  lastSource: AssistantSource | null;

  ask: (
    question: string,
    medications: Medication[],
    person: PersonContext | null,
    preferAi: boolean,
  ) => Promise<void>;
  reset: () => void;
  clearError: () => void;
};

function message(
  role: AssistantMessage['role'],
  text: string,
  source?: AssistantSource,
  note?: string,
): AssistantMessage {
  return { id: newId(), role, text, source, note, createdAt: isoNow() };
}

const OFFLINE_FALLBACK_NOTE =
  'The AI could not be reached, so this answer comes from the offline assistant, which only reads your records back.';

const initialMessages = (): AssistantMessage[] => [message('assistant', ASSISTANT_INTRO, 'offline')];

export const useAssistantStore = create<AssistantState>((set, get) => ({
  messages: initialMessages(),
  isThinking: false,
  error: null,
  lastSource: null,

  ask: async (rawQuestion, medications, person, preferAi) => {
    const question = rawQuestion.trim();
    if (question.length === 0 || get().isThinking) return;

    if (question.length > MAX_QUESTION_LENGTH) {
      set({
        error: customError(
          'MISSING_FIELD',
          `Please keep your question under ${MAX_QUESTION_LENGTH} characters.`,
        ),
      });
      return;
    }

    // Everything the assistant will see as "history": the turns before this one,
    // minus the canned intro (which is ours, not the model's).
    const history: AssistantTurn[] = get()
      .messages.slice(1)
      .map((m) => ({ role: m.role, content: m.text }));

    set({
      messages: [...get().messages, message('user', question)],
      isThinking: true,
      error: null,
    });

    // Safety screen: fixed reply, no service call, regardless of mode.
    const screen = screenQuestion(question);
    if (screen.level === 'high') {
      set({
        messages: [...get().messages, message('assistant', HIGH_RISK_REPLIES[screen.reason], 'offline')],
        isThinking: false,
        lastSource: 'offline',
      });
      return;
    }

    const request = {
      question,
      history,
      medications: medications.filter((m) => !m.archived).map((m) => toMedicationContext(m)),
      person,
    };

    const service = getAssistantService(preferAi);
    let result = await service.ask(request);
    let note: string | undefined;

    // A chat that goes silent when the network drops is worse than a plainer
    // answer: fall back to the offline assistant and say so on the bubble.
    if (!result.ok && service.kind === 'ai') {
      const fallback = await getAssistantService(false).ask(request);
      if (fallback.ok) {
        result = fallback;
        note = OFFLINE_FALLBACK_NOTE;
      }
    }

    if (!result.ok) {
      set({ isThinking: false, error: result.error });
      return;
    }

    set({
      messages: [
        ...get().messages,
        message('assistant', result.value.text, result.value.source, note),
      ],
      isThinking: false,
      lastSource: result.value.source,
    });
  },

  reset: () => set({ messages: initialMessages(), isThinking: false, error: null, lastSource: null }),

  clearError: () => set({ error: null }),
}));
