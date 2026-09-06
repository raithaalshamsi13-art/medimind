/**
 * MediMind API server — deployed on Railway.
 *
 * WHY THIS EXISTS
 * AI API keys must never ship inside the app (Phase 18). This service holds
 * one as a Railway environment variable. The app sends a question plus the
 * user's saved medicine details; this service adds the system prompt, calls
 * the configured model, and returns plain text.
 *
 * WHICH MODEL
 * See providers.ts. Set exactly one of:
 *   GEMINI_API_KEY      Google Gemini — free tier, no card (recommended)
 *   GROQ_API_KEY        Groq — free tier, open models
 *   ANTHROPIC_API_KEY   Anthropic Claude — paid
 *
 * ENDPOINTS
 *   GET  /health      → { ok, service, version, assistant, provider, model }
 *   POST /assistant   → { reply: string, model: string }
 *
 * OTHER ENVIRONMENT (Railway → Variables)
 *   APP_ACCESS_KEY      optional; if set, requests must carry it as `x-app-key`
 *                       (abuse mitigation, not authentication)
 *   ALLOWED_ORIGIN      optional; CORS origin, default "*"
 *   PORT                set by Railway automatically
 *
 * Nothing here logs the user's medicines.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { ProviderError, selectProvider, type Turn } from './providers.js';

/** Bumped on every change so /health shows which code is live. */
const VERSION = '1.2.0';

const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_TURNS = 10;
const MAX_MEDICATIONS = 50;
const MAX_BODY_BYTES = 64 * 1024;

/** Per-IP: this many requests per window. Enough for a person, not a script. */
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 40 };

const PORT = Number(process.env.PORT ?? 8787);
const APP_ACCESS_KEY = process.env.APP_ACCESS_KEY ?? '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';

const provider = selectProvider(process.env);

/**
 * The rules every model must follow. Written for a general model, not a
 * specific one, so it works unchanged across providers.
 */
const SYSTEM_PROMPT = `You are the assistant inside MediMind, a medication reminder app. You help people understand the medicines they have saved in the app. You are not a doctor or a pharmacist, and you must never act as one.

Rules you must follow on every reply:
1. Answer only from the medicine details supplied below (which the user typed or scanned from their own labels) and from general, widely known information about how to read a medicine label. Do not draw on knowledge about specific drugs to make recommendations.
1a. Dose questions ("what do I take now", "how much do I take", "when is my next dose"): read back the recorded dosage, the recorded instructions, and the schedule and next-dose time the app has already computed for that medicine. Use those computed values as given; do not recompute or alter them. If the dosage is "not recorded", say the amount is not recorded and to check the label — never supply an amount yourself. If there is no computed schedule, say you cannot work out a time from what was recorded.
2. Never diagnose. Never recommend starting, stopping, increasing, decreasing, doubling or skipping a dose. Never say whether medicines can be taken together or with alcohol. Never say a medicine is safe in pregnancy, while breastfeeding, or for children. For any of these, say plainly that you cannot advise and that a pharmacist or doctor can.
3. If something sounds like an emergency (chest pain, difficulty breathing, an allergic reaction, an overdose, loss of consciousness), tell the user to contact emergency services immediately and say nothing else.
4. If a detail was not recorded, say so. Do not guess it or fill it in from general knowledge.
5. For a missed dose: say not to take a double dose, to follow the label or leaflet, and to ask a pharmacist if unsure.
6. Use plain language and short sentences. Many users are older adults. Keep replies under 120 words unless you are listing medicines. Do not use markdown, headings or bullet symbols — plain sentences only.
7. End every reply with exactly this sentence on its own line: "Please check with your doctor or pharmacist before acting on this."`;

const SAFE_DECLINE =
  'I am not able to help with that question. Please speak to your pharmacist or doctor.\n' +
  'Please check with your doctor or pharmacist before acting on this.';

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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleAssistant(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!provider) {
    json(res, 500, {
      error: 'No AI provider is configured on the server',
      detail: 'Set GEMINI_API_KEY, GROQ_API_KEY or ANTHROPIC_API_KEY',
    });
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
    const result = await provider.complete({
      system: SYSTEM_PROMPT,
      medicationsText: describeMedications(medications),
      history,
      question,
    });
    const reply = result.refused || result.text.length === 0 ? SAFE_DECLINE : result.text;
    json(res, 200, { reply, model: result.model, provider: provider.name });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error('Provider error', error.provider, error.status, error.message);
      if (error.status === 429) {
        json(res, 429, { error: 'The assistant is busy. Please try again in a moment.' });
        return;
      }
      // `detail` carries the provider's own status and message - never a key -
      // so a failure is explainable without server access.
      json(res, 502, { error: 'The assistant is unavailable right now.', detail: error.message });
      return;
    }
    console.error('Unexpected error', error);
    json(res, 500, {
      error: 'Unexpected server error.',
      detail: error instanceof Error ? error.message : String(error),
    });
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
      assistant: Boolean(provider),
      provider: provider?.name ?? null,
      model: provider?.model ?? null,
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
    `medimind-server v${VERSION} listening on port ${PORT} ` +
      `(assistant: ${provider ? `${provider.name} / ${provider.model}` : 'NOT configured'})`,
  );
});
