/**
 * MediMind API server — deployed on Railway.
 *
 * WHY THIS EXISTS
 * The Anthropic API key must never ship inside the app (Phase 18). This
 * service holds it as a Railway environment variable. The app sends a question
 * plus the user's saved medicine details; this service adds the system prompt,
 * calls Claude, and returns plain text.
 *
 * ENDPOINTS
 *   GET  /health      → { ok, service, version, assistant }
 *   POST /assistant   → { reply: string, model: string }
 *
 * ENVIRONMENT (set in the Railway dashboard → Variables)
 *   ANTHROPIC_API_KEY   required
 *   APP_ACCESS_KEY      optional; if set, requests must carry it as `x-app-key`
 *                       (abuse mitigation, not authentication)
 *   ALLOWED_ORIGIN      optional; CORS origin, default "*"
 *   PORT                set by Railway automatically
 *
 * Deliberately dependency-light: Node's built-in http server plus the official
 * Anthropic SDK. Nothing here logs the user's medicines.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import Anthropic from '@anthropic-ai/sdk';

/** Bumped on every change so /health shows which code is live. */
const VERSION = '1.1.0';

const MODEL = 'claude-opus-5';
const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_TURNS = 10;
const MAX_MEDICATIONS = 50;
const MAX_BODY_BYTES = 64 * 1024;

/** Per-IP: this many requests per window. Enough for a person, not a script. */
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 40 };

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const APP_ACCESS_KEY = process.env.APP_ACCESS_KEY ?? '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';

/**
 * Stable across every request, so it is cached (cache_control below). The
 * per-user medicine list goes in a SEPARATE system block after it, so varying
 * medicines do not invalidate the cached prefix.
 */
const SYSTEM_PROMPT = `You are the assistant inside MediMind, a medication reminder app. You help people understand the medicines they have saved in the app. You are not a doctor or a pharmacist, and you must never act as one.

Rules you must follow on every reply:
1. Answer only from the medicine details supplied in this conversation (which the user typed or scanned from their own labels) and from general, widely known information about how to read a medicine label. Do not draw on knowledge about specific drugs to make recommendations.
1a. Dose questions ("what do I take now", "how much do I take", "when is my next dose"): read back the recorded dosage, the recorded instructions, and the schedule and next-dose time the app has already computed for that medicine. Use those computed values as given; do not recompute or alter them. If the dosage is "not recorded", say the amount is not recorded and to check the label — never supply an amount yourself. If there is no computed schedule, say you cannot work out a time from what was recorded.
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
  schedule: { times: string[]; description: string; asNeeded: boolean } | null;
  nextDoseLabel: string | null;
};
type Body = { question?: unknown; history?: unknown; medications?: unknown };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, content-type, x-app-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
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
    optionalText(m.expirationDate) &&
    (m.schedule === null || typeof m.schedule === 'object') &&
    optionalText(m.nextDoseLabel)
  );
}

function describeMedications(medications: MedicationContext[]): string {
  if (medications.length === 0) return 'The user has not saved any medicines yet.';
  const lines = medications.map((m) =>
    [
      `- ${m.name}`,
      `dosage: ${m.dosage ?? 'not recorded'}`,
      `frequency: ${m.frequency ?? 'not recorded'}`,
      `instructions: ${m.instructions ?? 'not recorded'}`,
      `expiry: ${m.expirationDate ?? 'not recorded'}`,
      m.schedule
        ? m.schedule.asNeeded
          ? 'schedule: as needed (no fixed times)'
          : `schedule: ${m.schedule.description} at ${m.schedule.times.join(', ')}; next dose: ${m.nextDoseLabel ?? 'unknown'}`
        : 'schedule: could not be worked out from the recorded frequency',
    ].join('; '),
  );
  return (
    "The user's saved medicines, exactly as recorded from their labels (may be incomplete):\n" +
    lines.join('\n')
  );
}

// Simple in-memory rate limit. Good enough for one small instance; swap for a
// shared store if the service is ever scaled out.
const hits = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

/** Text of a Claude reply, or the safe decline if it refused or said nothing. */
function extractReply(response: Anthropic.Message | Anthropic.Beta.BetaMessage): string {
  if (response.stop_reason === 'refusal') return SAFE_DECLINE;
  const text = response.content
    .filter((block): block is Anthropic.TextBlock | Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  return text.length > 0 ? text : SAFE_DECLINE;
}

// ---------------------------------------------------------------------------
// Claude calls
// ---------------------------------------------------------------------------

const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

type ClaudeInput = {
  system: string;
  medicationsText: string;
  history: Turn[];
  question: string;
};

/**
 * Preferred request: refusal fallback + effort control. These are newer API
 * features; if the API rejects the request shape (HTTP 400), `askClaude`
 * retries with the plain request below rather than failing the user.
 */
async function askFull(c: Anthropic, input: ClaudeInput) {
  return c.beta.messages.create({
    model: MODEL,
    max_tokens: 2048,
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: 'claude-opus-4-8' }],
    output_config: { effort: 'medium' },
    system: [
      { type: 'text', text: input.system, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: input.medicationsText },
    ],
    messages: [...input.history, { role: 'user', content: input.question }],
  });
}

/** Plain request: nothing beyond the standard Messages API. */
async function askPlain(c: Anthropic, input: ClaudeInput) {
  return c.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      { type: 'text', text: input.system, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: input.medicationsText },
    ],
    messages: [...input.history, { role: 'user', content: input.question }],
  });
}

async function askClaude(c: Anthropic, input: ClaudeInput) {
  try {
    return await askFull(c, input);
  } catch (error) {
    if (error instanceof Anthropic.BadRequestError) {
      console.warn('Full request rejected (400) - retrying with the plain request:', error.message);
      return askPlain(c, input);
    }
    throw error;
  }
}

/**
 * Turn an Anthropic error into a response the app can show and a developer
 * can diagnose. `detail` carries the API's own status and message - these
 * never contain the key - so a failure is explainable without server access.
 */
function anthropicErrorResponse(res: ServerResponse, error: unknown): void {
  if (error instanceof Anthropic.RateLimitError) {
    json(res, 429, { error: 'The assistant is busy. Please try again in a moment.' });
    return;
  }
  if (error instanceof Anthropic.APIError) {
    console.error('Anthropic API error', error.status, error.message);
    json(res, 502, {
      error: 'The assistant is unavailable right now.',
      detail: `anthropic ${error.status ?? 'error'}: ${error.message}`,
    });
    return;
  }
  console.error('Unexpected error', error);
  json(res, 500, {
    error: 'Unexpected server error.',
    detail: error instanceof Error ? error.message : String(error),
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleAssistant(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!client) {
    json(res, 500, { error: 'ANTHROPIC_API_KEY is not configured on the server' });
    return;
  }

  if (APP_ACCESS_KEY && req.headers['x-app-key'] !== APP_ACCESS_KEY) {
    json(res, 401, { error: 'Missing or invalid app key' });
    return;
  }

  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown';
  if (isRateLimited(ip)) {
    json(res, 429, { error: 'Too many requests. Please wait a few minutes.' });
    return;
  }

  let body: Body;
  try {
    body = JSON.parse(await readBody(req)) as Body;
  } catch {
    json(res, 400, { error: 'Request body must be JSON under 64 KB' });
    return;
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length === 0 || question.length > MAX_QUESTION_LENGTH) {
    json(res, 400, { error: `question must be 1-${MAX_QUESTION_LENGTH} characters` });
    return;
  }

  const history = Array.isArray(body.history)
    ? body.history.filter(isTurn).slice(-MAX_HISTORY_TURNS)
    : [];
  const medications = Array.isArray(body.medications)
    ? body.medications.filter(isMedication).slice(0, MAX_MEDICATIONS)
    : [];

  try {
    const response = await askClaude(client, {
      system: SYSTEM_PROMPT,
      medicationsText: describeMedications(medications),
      history,
      question,
    });
    json(res, 200, { reply: extractReply(response), model: response.model });
  } catch (error) {
    anthropicErrorResponse(res, error);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    json(res, 200, {
      ok: true,
      service: 'medimind-server',
      version: VERSION,
      assistant: Boolean(client),
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/assistant') {
    await handleAssistant(req, res);
    return;
  }
  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(
    `medimind-server v${VERSION} listening on port ${PORT} (assistant ${client ? 'ready' : 'NOT configured'})`,
  );
});
