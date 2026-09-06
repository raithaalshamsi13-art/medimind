/**
 * Claude-backed assistant, reached through a server-side proxy.
 *
 * SECURITY (Phase 18): the app never holds the Anthropic API key. It POSTs the
 * question to a Supabase Edge Function (`supabase/functions/assistant`), which
 * holds the key as a server secret, applies the system prompt, calls Claude,
 * and returns plain text. Anyone who decompiles the app finds only a URL.
 *
 * PRIVACY: the request carries exactly `MedicationContext` — name, dosage,
 * frequency, instructions, expiry — for the user's saved medicines, plus the
 * recent turns of this conversation. Nothing else.
 */

import { env } from '@/config/env';
import type { AssistantReply } from '@/domain/assistant';
import { appError, toAppError } from '@/lib/errors';
import { fail, ok, type Result } from '@/lib/result';

import type { AssistantRequest, AssistantService } from './AssistantService';

const REQUEST_TIMEOUT_MS = 30_000;

/** Only the most recent turns are sent, to bound cost and payload size. */
const MAX_HISTORY_TURNS = 10;

type ProxyResponse = { reply?: unknown; error?: unknown };

export class ProxyAssistant implements AssistantService {
  readonly kind = 'ai' as const;

  constructor(private readonly endpoint: string = env.assistantEndpoint ?? '') {}

  async ask(request: AssistantRequest): Promise<Result<AssistantReply>> {
    if (!this.endpoint) {
      return fail(appError('ASSISTANT_UNAVAILABLE', 'EXPO_PUBLIC_ASSISTANT_ENDPOINT is not set'));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      // Supabase Edge Functions expect the project's public anon key as a
      // bearer token. It is a publishable value, not a secret.
      if (env.supabaseAnonKey) headers.Authorization = `Bearer ${env.supabaseAnonKey}`;

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          question: request.question,
          history: request.history.slice(-MAX_HISTORY_TURNS),
          medications: request.medications,
        }),
      });

      if (!response.ok) {
        return fail(appError('ASSISTANT_UNAVAILABLE', `proxy responded ${response.status}`));
      }

      const payload = (await response.json()) as ProxyResponse;
      if (typeof payload.reply !== 'string' || payload.reply.trim().length === 0) {
        return fail(appError('ASSISTANT_UNAVAILABLE', 'proxy returned no reply text'));
      }

      return ok({ text: payload.reply.trim(), source: 'ai' });
    } catch (error) {
      // fetch throws a TypeError when there is no connectivity at all.
      if (error instanceof TypeError) return fail(toAppError(error, 'NETWORK_UNAVAILABLE'));
      return fail(toAppError(error, 'ASSISTANT_UNAVAILABLE'));
    } finally {
      clearTimeout(timer);
    }
  }
}
