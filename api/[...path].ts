/**
 * The MediMind API as a Vercel serverless function — the same code that runs
 * on Railway, hosted for free next to the web app:
 *
 *   https://<vercel-domain>/api/health
 *   https://<vercel-domain>/api/assistant
 *   https://<vercel-domain>/api/scan
 *
 * The AI key lives in Vercel's environment variables (GEMINI_API_KEY, plus
 * APP_ACCESS_KEY), which are server-side only — never prefixed EXPO_PUBLIC_,
 * so they never reach the app bundle.
 *
 * Vercel's body parser is switched off so the handler reads the raw stream
 * exactly as it does under Node's http server.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleRequest } from '../server/src/app';

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleRequest(req, res);
}
