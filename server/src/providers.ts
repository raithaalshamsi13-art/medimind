/**
 * Language-model providers behind the assistant.
 *
 * The server does not care which model answers. Each provider takes the same
 * input (system prompt, the user's medicine list, recent turns, the question)
 * and returns plain text. Which one runs is decided by which API key is set:
 *
 *   GEMINI_API_KEY     → Google Gemini  (free tier via Google AI Studio, no card)
 *   GROQ_API_KEY       → Groq          (free tier, open models such as Llama)
 *   ANTHROPIC_API_KEY  → Anthropic Claude (paid)
 *
 * If more than one key is set, AI_PROVIDER=gemini|groq|anthropic picks.
 *
 * Gemini and Groq are called with plain `fetch` against their REST APIs — no
 * extra dependencies. Anthropic uses its official SDK.
 */

import Anthropic from '@anthropic-ai/sdk';

export type Turn = { role: 'user' | 'assistant'; content: string };

export type CompletionInput = {
  system: string;
  medicationsText: string;
  history: Turn[];
  question: string;
};

export type CompletionResult = {
  text: string;
  /** True when the model itself declined for safety reasons. */
  refused: boolean;
  model: string;
};

/** Thrown for any upstream failure; `status` mirrors the provider's HTTP code. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly provider: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface LlmProvider {
  readonly name: 'gemini' | 'groq' | 'anthropic';
  readonly model: string;
  complete(input: CompletionInput): Promise<CompletionResult>;
}

const MAX_OUTPUT_TOKENS = 1024;
/** Low temperature: we want the label read back faithfully, not creatively. */
const TEMPERATURE = 0.3;

// ---------------------------------------------------------------------------
// Google Gemini — free tier, https://aistudio.google.com/apikey
// ---------------------------------------------------------------------------

export function createGeminiProvider(apiKey: string, model: string): LlmProvider {
  return {
    name: 'gemini',
    model,
    async complete(input) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
        `:generateContent?key=${encodeURIComponent(apiKey)}`;

      const contents = [
        ...input.history.map((t) => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: t.content }],
        })),
        { role: 'user', parts: [{ text: input.question }] },
      ];

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${input.system}\n\n${input.medicationsText}` }] },
          contents,
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ProviderError(`Gemini ${res.status}: ${body.slice(0, 300)}`, res.status, 'gemini');
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };

      if (data.promptFeedback?.blockReason) {
        return { text: '', refused: true, model };
      }
      const candidate = data.candidates?.[0];
      if (!candidate || candidate.finishReason === 'SAFETY') {
        return { text: '', refused: true, model };
      }
      const text = (candidate.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim();
      return { text, refused: false, model };
    },
  };
}

// ---------------------------------------------------------------------------
// Groq — free tier, https://console.groq.com/keys (OpenAI-compatible API)
// ---------------------------------------------------------------------------

export function createGroqProvider(apiKey: string, model: string): LlmProvider {
  return {
    name: 'groq',
    model,
    async complete(input) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
          messages: [
            { role: 'system', content: `${input.system}\n\n${input.medicationsText}` },
            ...input.history.map((t) => ({ role: t.role, content: t.content })),
            { role: 'user', content: input.question },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ProviderError(`Groq ${res.status}: ${body.slice(0, 300)}`, res.status, 'groq');
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const choice = data.choices?.[0];
      const text = (choice?.message?.content ?? '').trim();
      return { text, refused: choice?.finish_reason === 'content_filter', model };
    },
  };
}

// ---------------------------------------------------------------------------
// Anthropic Claude — paid, https://console.anthropic.com
// ---------------------------------------------------------------------------

export function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  const client = new Anthropic({ apiKey });
  return {
    name: 'anthropic',
    model,
    async complete(input) {
      try {
        const response = await client.messages.create({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: [
            { type: 'text', text: input.system, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: input.medicationsText },
          ],
          messages: [...input.history, { role: 'user', content: input.question }],
        });
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return { text, refused: response.stop_reason === 'refusal', model: response.model };
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new ProviderError(
            `Anthropic ${error.status ?? 'error'}: ${error.message}`,
            error.status ?? 502,
            'anthropic',
          );
        }
        throw error;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-opus-5',
} as const;

/**
 * Pick a provider from the environment. Returns null when no key is set at
 * all, in which case the app keeps using its offline assistant.
 */
export function selectProvider(env: NodeJS.ProcessEnv): LlmProvider | null {
  const gemini = env.GEMINI_API_KEY?.trim();
  const groq = env.GROQ_API_KEY?.trim();
  const anthropic = env.ANTHROPIC_API_KEY?.trim();
  const forced = env.AI_PROVIDER?.trim().toLowerCase();

  const wants = (name: string) => !forced || forced === name;

  if (gemini && wants('gemini')) {
    return createGeminiProvider(gemini, env.GEMINI_MODEL?.trim() || DEFAULT_MODELS.gemini);
  }
  if (groq && wants('groq')) {
    return createGroqProvider(groq, env.GROQ_MODEL?.trim() || DEFAULT_MODELS.groq);
  }
  if (anthropic && wants('anthropic')) {
    return createAnthropicProvider(anthropic, env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODELS.anthropic);
  }
  return null;
}
