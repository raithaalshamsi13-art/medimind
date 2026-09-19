/**
 * Assistant contract.
 *
 * Two implementations, same shape as `AuthService` and `MedicationRepository`:
 *
 *   OfflineAssistant  rule-based, runs on the device, needs no network — the
 *                     demo-mode default, and the fallback whenever the AI is
 *                     unreachable
 *   ProxyAssistant    sends the question to a server-side function that holds
 *                     the Claude API key and returns the model's reply
 *
 * Neither is ever handed a question that failed `screenQuestion` — the store
 * answers those itself with a fixed safe reply.
 */

import type {
  AssistantReply,
  AssistantSource,
  AssistantTurn,
  MedicationContext,
  PersonContext,
} from '@/domain/assistant';
import type { Result } from '@/lib/result';

export type AssistantRequest = {
  question: string;
  /** Earlier turns, oldest first, so the AI can follow up on itself. */
  history: AssistantTurn[];
  /** ONE family member's saved medicines. */
  medications: MedicationContext[];
  /** That member's health profile, as context only. Null when unknown. */
  person: PersonContext | null;
  /** The app language — the AI replies in it. */
  language: 'en' | 'ar';
};

export interface AssistantService {
  readonly kind: AssistantSource;
  ask(request: AssistantRequest): Promise<Result<AssistantReply>>;
}
