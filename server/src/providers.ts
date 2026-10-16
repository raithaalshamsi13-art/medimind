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
 * All three are called with plain `fetch` against their REST APIs — the server
 * has no runtime dependencies, so the same code runs on Railway, on Vercel
 * serverless functions, or on any Node 20+ host.
 */

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

export type LabelReadInput = {
  /** Base64 image bytes, no data: prefix. */
  imageBase64: string;
  mimeType: string;
  /** The instruction that asks for JSON — see app.ts SCAN_PROMPT. */
  prompt: string;
  /** Give up after this many ms (default VISION_TIMEOUT_MS); lets a retry fit in the host's limit. */
  timeoutMs?: number;
};

export interface LlmProvider {
  readonly name: 'gemini' | 'groq' | 'anthropic';
  readonly model: string;
  complete(input: CompletionInput): Promise<CompletionResult>;
  /**
   * Read a medicine label from a photo and return the model's raw text reply
   * (expected to be JSON; index.ts parses and validates it). Providers
   * without a vision model throw ProviderError 501.
   */
  readLabel(input: LabelReadInput): Promise<string>;
}

/**
 * Generous on purpose. Gemini 3 models spend part of this budget on internal
 * "thinking" before the visible answer, so 1024 truncated replies
 * mid-sentence. The prompt itself keeps answers short.
 */
const MAX_OUTPUT_TOKENS = 8192;
/** The vision model must answer within this, or the server reports a timeout. */
const VISION_TIMEOUT_MS = 50_000;

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
      if (candidate.finishReason === 'MAX_TOKENS') {
        // Should be rare with the larger budget; log it so a recurrence is
        // visible in Railway's logs rather than as a mysteriously short reply.
        console.warn('Gemini reply hit MAX_TOKENS', { model, chars: text.length });
      }
      return { text, refused: false, model };
    },

    async readLabel(input) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
        `:generateContent?key=${encodeURIComponent(apiKey)}`;
      // A vision call that hangs must not hold the request open forever:
      // the app gives up at 60 s, so the server gives up first and says why.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? VISION_TIMEOUT_MS);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
                { text: input.prompt },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
      })
        .catch((error: unknown) => {
          throw new ProviderError(
            error instanceof Error && error.name === 'AbortError' ? 'Gemini timed out' : `Gemini unreachable: ${String(error)}`,
            504,
            'gemini',
          );
        })
        .finally(() => clearTimeout(timer));
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ProviderError(`Gemini ${res.status}: ${body.slice(0, 300)}`, res.status, 'gemini');
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
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

    async readLabel() {
      // Groq's free chat models are text-only; scanning needs Gemini or Claude.
      throw new ProviderError('Label scanning is not available with the Groq provider', 501, 'groq');
    },
  };
}

// ---------------------------------------------------------------------------
// Anthropic Claude — paid, https://console.anthropic.com
// ---------------------------------------------------------------------------

export function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  type AnthropicReply = { content?: { type: string; text?: string }[]; stop_reason?: string; model?: string };

  async function call(body: unknown): Promise<AnthropicReply> {
    const res = await fetch(ANTHROPIC_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Anthropic ${res.status}: ${text.slice(0, 300)}`, res.status, 'anthropic');
    }
    return (await res.json()) as AnthropicReply;
  }

  const textOf = (reply: AnthropicReply) =>
    (reply.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim();

  return {
    name: 'anthropic',
    model,
    async complete(input) {
      const reply = await call({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          { type: 'text', text: input.system, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: input.medicationsText },
        ],
        messages: [...input.history, { role: 'user', content: input.question }],
      });
      return { text: textOf(reply), refused: reply.stop_reason === 'refusal', model: reply.model ?? model };
    },

    async readLabel(input) {
      const mediaType = input.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const reply = await call({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: input.imageBase64 } },
              { type: 'text', text: input.prompt },
            ],
          },
        ],
      });
      return textOf(reply);
    },
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/** Models the key can call (names only), for the /models diagnostic. */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new ProviderError(`Gemini ${res.status}`, res.status, 'gemini');
  const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((n) => n.length > 0)
    .sort();
}

export const DEFAULT_MODELS = {
  gemini: 'gemini-3.6-flash',
  /** Tried once when the main model keeps answering 503 "high demand"; lite models are rarely saturated. */
  geminiFallback: 'gemini-3.5-flash-lite',
  groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-opus-5',
} as const;

/**
 * Pick a provider from the environment. Returns null when no key is set at
 * all, in which case the app keeps using its offline assistant.
 */
/**
 * Read a variable by name, accepting any letter case ("gemini_api_key" is
 * a real mistake people make in hosting dashboards, and Linux treats it as
 * a different variable). The exact name wins when both exist.
 */
export function readEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const exact = env[name];
  if (exact !== undefined && exact.trim().length > 0) return exact.trim();
  const wanted = name.toLowerCase();
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === wanted && env[key] && env[key]!.trim().length > 0) return env[key]!.trim();
  }
  return undefined;
}

export function selectProvider(env: NodeJS.ProcessEnv): LlmProvider | null {
  const gemini = readEnv(env, 'GEMINI_API_KEY');
  const groq = readEnv(env, 'GROQ_API_KEY');
  const anthropic = readEnv(env, 'ANTHROPIC_API_KEY');
  const forced = readEnv(env, 'AI_PROVIDER')?.toLowerCase();

  const wants = (name: string) => !forced || forced === name;

  if (gemini && wants('gemini')) {
    return createGeminiProvider(gemini, readEnv(env, 'GEMINI_MODEL') || DEFAULT_MODELS.gemini);
  }
  if (groq && wants('groq')) {
    return createGroqProvider(groq, readEnv(env, 'GROQ_MODEL') || DEFAULT_MODELS.groq);
  }
  if (anthropic && wants('anthropic')) {
    return createAnthropicProvider(anthropic, readEnv(env, 'ANTHROPIC_MODEL') || DEFAULT_MODELS.anthropic);
  }
  return null;
}
