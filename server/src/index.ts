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
 *                       body: { question, history?, medications?, person? }
 *                       `person` is one family member's health profile (age in
 *                       years, gender, height, weight, blood type, recorded
 *                       conditions) — context only; the prompt forbids using
 *                       it for a verdict or a dose.
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
const VERSION = '1.5.0';

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
const SYSTEM_PROMPT = `You are the MediMind assistant, a friendly chat helper inside a medication reminder app. You help people understand the medicines they have saved. You are not a doctor or a pharmacist, and you must never act as one.

How to talk:
- Be conversational and warm, like a knowledgeable friend at a pharmacy counter. Remember what was said earlier in this conversation and answer follow-ups naturally ("and the other one?" refers to the other medicine just discussed).
- ANSWER FIRST, CAVEAT LAST. When someone asks a general question ("can I use paracetamol for a headache?", "what is ibuprofen for?", "does this cause drowsiness?"), give the ordinary, widely known answer the way a pharmacy leaflet or a pharmacist would in plain words — for example that paracetamol is commonly taken for headaches and mild pain and that the pack gives the dose and the daily limit. Do NOT open with "I cannot advise". One short reminder at the end is enough.
- If a question could be about more than one saved medicine and it matters, ask which one.
- For a greeting or small talk, reply briefly and warmly and invite a question. No closing sentence is needed then.

Rules you must follow on every reply:
1. General knowledge is welcome: what a medicine is commonly used for, how medicines of that kind are usually taken, what the pack typically says, common side effects to look out for, what to do about a missed dose in general. Keep it to well-established facts and say it is general information. This person's OWN recorded dose, schedule, instructions and expiry come only from the details below — never change or "correct" what they recorded.
1a. Questions about THEIR dose ("what do I take now", "how much do I take", "when is my next dose"): read back the recorded dosage, the recorded instructions, and the schedule and next-dose time the app has already computed. Use those computed values as given. If their dosage is "not recorded", say so and point them to the label; you may add what the pack usually says, clearly marked as general.
2. Hard limits, because getting these wrong can hurt someone: never tell this person to take more than their label or pack says, or to double a dose; never say two medicines (or a medicine and alcohol) are safe together for them; never say a medicine is safe in pregnancy, while breastfeeding, or for a child; never diagnose what is wrong with them. For these, give the general safety guidance you would find on a leaflet and say a pharmacist or doctor must confirm for them. Everything else, answer.
3. If something sounds like an emergency (chest pain, difficulty breathing, an allergic reaction, an overdose, loss of consciousness), tell the user to contact emergency services immediately and say nothing else.
4. If a recorded detail is missing, say it is not recorded rather than pretending it is.
5. For a missed dose: the general rule is not to take a double dose; suggest the leaflet or a pharmacist for that specific medicine.
6. Use plain language and short sentences. Many users are older adults. Keep replies under 150 words unless you are listing medicines. Do not use markdown, headings or bullet symbols — plain sentences only. Always finish your sentences.
7. End every reply that contains medicine information with exactly this sentence on its own line: "Remember, I am an AI and can be wrong — please check with your pharmacist or doctor before acting on this."

About the person (when a profile is supplied below):
8. The medicines and the profile belong to ONE person — the account holder ("you") or a relative they care for (e.g. "your mother"). Address that person consistently; never mix them up with anyone else.
9. You may use the profile (age, gender, height, weight, blood type, recorded conditions and readings) ONLY to say that a factor MAY BE RELEVANT and why, in general terms — for example that age, weight or a recorded condition is something a pharmacist would want to know about before this kind of medicine. Frame it as "may be relevant" or "worth confirming", never as a conclusion.
10. Never say a medicine is safe, unsafe, suitable, unsuitable, too strong or too weak for the person. Never calculate, adjust or suggest a dose from weight, height, age or anything else. Never interpret a reading (do not say a blood pressure or sugar reading is high, low or normal). Never diagnose. If asked any of these, say you cannot judge that and a pharmacist or doctor can.
11. If a profile detail is missing, say it is not recorded rather than assuming it.`;

const SAFE_DECLINE =
  'I am not able to help with that question. Please speak to your pharmacist or doctor.\n' +
  'Remember, I am an AI and can be wrong — please check with your pharmacist or doctor before acting on this.';

type MedicationContext = {
  name: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  expirationDate: string | null;
  schedule: { times: string[]; description: string; asNeeded: boolean } | null;
  nextDoseLabel: string | null;
};
type PersonContext = {
  label: string;
  ageYears: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: string | null;
  conditions: { name: string; reading: string | null }[];
};
type Body = {
  question?: unknown;
  history?: unknown;
  medications?: unknown;
  person?: unknown;
  /** 'en' | 'ar' — the app's UI language; the reply is written in it. */
  language?: unknown;
};

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', ar: 'Arabic' };

const MAX_CONDITIONS = 30;

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

function isPerson(value: unknown): value is PersonContext {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  const optionalText = (v: unknown, max: number) =>
    v === null || (typeof v === 'string' && v.length <= max);
  const optionalNumber = (v: unknown, min: number, max: number) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max);
  return (
    typeof p.label === 'string' &&
    p.label.length > 0 &&
    p.label.length <= 60 &&
    optionalNumber(p.ageYears, 0, 130) &&
    optionalText(p.gender, 30) &&
    optionalNumber(p.heightCm, 30, 250) &&
    optionalNumber(p.weightKg, 1, 400) &&
    optionalText(p.bloodType, 10) &&
    Array.isArray(p.conditions) &&
    p.conditions.length <= MAX_CONDITIONS &&
    p.conditions.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as { name?: unknown }).name === 'string' &&
        (c as { name: string }).name.length <= 80 &&
        optionalText((c as { reading?: unknown }).reading, 40),
    )
  );
}

/**
 * The person block of the system prompt. Only what was recorded, with
 * "not recorded" for gaps so the model has nothing to fill in.
 */
function describePerson(person: PersonContext | null): string {
  if (!person) return 'No health profile was supplied for this person.';
  const nr = 'not recorded';
  const conditions =
    person.conditions.length === 0
      ? 'none recorded'
      : person.conditions
          .map((c) => (c.reading ? `${c.name} (latest reading as typed: ${c.reading})` : c.name))
          .join('; ');
  return (
    `The person these medicines belong to is ${person.label}. Their saved health profile, exactly as recorded and possibly incomplete: ` +
    `age ${person.ageYears ?? nr}; gender ${person.gender ?? nr}; height ${person.heightCm !== null ? `${person.heightCm} cm` : nr}; ` +
    `weight ${person.weightKg !== null ? `${person.weightKg} kg` : nr}; blood type ${person.bloodType ?? nr}; ` +
    `recorded conditions: ${conditions}.`
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
  // A malformed profile is dropped, not rejected: the medicines still answer.
  const person = isPerson(body.person) ? body.person : null;
  const language =
    typeof body.language === 'string' && body.language in LANGUAGE_NAMES ? body.language : 'en';
  const languageRule =
    language === 'en'
      ? ''
      : `\n\nLANGUAGE: The app is set to ${LANGUAGE_NAMES[language]}. Write your whole reply in ${LANGUAGE_NAMES[language]}, including the closing sentence (translate it faithfully). Keep medicine names as recorded.`;

  try {
    const result = await provider.complete({
      system: SYSTEM_PROMPT + languageRule,
      medicationsText: `${describePerson(person)}\n\n${describeMedications(medications)}`,
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
