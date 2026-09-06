/**
 * MediMind assistant proxy — a Supabase Edge Function (Deno).
 *
 * WHY THIS EXISTS
 * The Anthropic API key must never ship inside the mobile app (Phase 18). This
 * function holds it as a server secret. The app sends a question plus the
 * user's saved medicine details; this function adds the system prompt, calls
 * Claude, and returns plain text.
 *
 * DEPLOY
 *   supabase functions deploy assistant
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 * then in the app's .env.local:
 *   EXPO_PUBLIC_ASSISTANT_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/assistant
 *
 * This file is excluded from the app's TypeScript program (see tsconfig.json
 * "exclude") because it targets the Deno runtime, not React Native.
 */

import Anthropic from 'npm:@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';
const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_TURNS = 10;
const MAX_MEDICATIONS = 50;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Stable across every request, so it is cached (cache_control below). The
 * per-user medicine list goes in a SEPARATE system block after it, so varying
 * medicines do not invalidate the cached prefix.
 */
const SYSTEM_PROMPT = `You are the assistant inside MediMind, a medication reminder app. You help people understand the medicines they have saved in the app. You are not a doctor or a pharmacist, and you must never act as one.

Rules you must follow on every reply:
1. Answer only from the medicine details supplied in this conversation (which the user typed or scanned from their own labels) and from general, widely known information about how to read a medicine label. Do not draw on knowledge about specific drugs to make recommendations.
2. Never diagnose. Never recommend starting, stopping, increasing, decreasing, doubling or skipping a dose. Never say whether medicines can be taken together or with alcohol. Never say a medicine is safe in pregnancy, while breastfeeding, or for children. For any of these, say plainly that you cannot advise and that a pharmacist or doctor can.
3. If something sounds like an emergency (chest pain, difficulty breathing, an allergic reaction, an overdose, loss of consciousness), tell the user to contact emergency services immediately and say nothing else.
4. If a detail was not recorded, say so. Do not guess it or fill it in from general knowledge.
5. For a missed dose: say not to take a double dose, to follow the label or leaflet, and to ask a pharmacist if unsure.
6. Use plain language and short sentences. Many users are older adults. Keep replies under 120 words unless you are listing medicines.
7. End every reply with exactly this sentence on its own line: "Please check with your doctor or pharmacist before acting on this."`;

const SAFE_DECLINE =
  'I am not able to help with that question. Please speak to your pharmacist or doctor.\n' +
  'Please check with your doctor or pharmacist before acting on this.';

type Turn = { role: 'user' | 'assistant'; content: string };
type MedicationContext = {
  name: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  expirationDate: string | null;
};
type Body = { question?: unknown; history?: unknown; medications?: unknown };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isTurn(value: unknown): value is Turn {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Turn;
  return (
    (t.role === 'user' || t.role === 'assistant') &&
    typeof t.content === 'string' &&
    t.content.length <= 4000
  );
}

function isMedication(value: unknown): value is MedicationContext {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  const optionalText = (v: unknown) => v === null || (typeof v === 'string' && v.length <= 500);
  return (
    typeof m.name === 'string' &&
    m.name.length > 0 &&
    m.name.length <= 100 &&
    optionalText(m.dosage) &&
    optionalText(m.frequency) &&
    optionalText(m.instructions) &&
    optionalText(m.expirationDate)
  );
}

function describeMedications(medications: MedicationContext[]): string {
  if (medications.length === 0) {
    return 'The user has not saved any medicines yet.';
  }
  const lines = medications.map((m) =>
    [
      `- ${m.name}`,
      `dosage: ${m.dosage ?? 'not recorded'}`,
      `frequency: ${m.frequency ?? 'not recorded'}`,
      `instructions: ${m.instructions ?? 'not recorded'}`,
      `expiry: ${m.expirationDate ?? 'not recorded'}`,
    ].join('; '),
  );
  return (
    "The user's saved medicines, exactly as recorded from their labels (may be incomplete):\n" +
    lines.join('\n')
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return json(500, { error: 'ANTHROPIC_API_KEY is not configured on the server' });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: 'Request body must be JSON' });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length === 0 || question.length > MAX_QUESTION_LENGTH) {
    return json(400, { error: `question must be 1-${MAX_QUESTION_LENGTH} characters` });
  }

  const history = Array.isArray(body.history)
    ? body.history.filter(isTurn).slice(-MAX_HISTORY_TURNS)
    : [];
  const medications = Array.isArray(body.medications)
    ? body.medications.filter(isMedication).slice(0, MAX_MEDICATIONS)
    : [];

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      // Refusal fallback: if the primary model declines on a safety category,
      // the API re-runs the request on the fallback model in the same call.
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      // Adaptive thinking is on by default for this model; medium effort is
      // plenty for short conversational replies and keeps latency down.
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: describeMedications(medications) },
      ],
      messages: [...history, { role: 'user', content: question }],
    });

    if (response.stop_reason === 'refusal') {
      return json(200, { reply: SAFE_DECLINE, model: response.model });
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return json(200, { reply: text.length > 0 ? text : SAFE_DECLINE, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json(429, { error: 'The assistant is busy. Please try again in a moment.' });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error', error.status, error.message);
      return json(502, { error: 'The assistant is unavailable right now.' });
    }
    console.error('Unexpected error', error);
    return json(500, { error: 'Unexpected server error.' });
  }
});
