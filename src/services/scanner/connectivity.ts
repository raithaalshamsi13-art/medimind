/**
 * Two small probes used to explain a failed scan and to power
 * Settings → Scanner → "Test connection".
 *
 *   probeInternet  — fetches a tiny, always-on Google endpoint. On the web it
 *                    is an opaque (no-cors) request: it resolves when the
 *                    network is up and rejects when it is not. Nothing about
 *                    the user is sent.
 *   probeServer    — GET /health on the MediMind server: version, provider,
 *                    and whether label reading (a vision model) is available.
 */

import { Platform } from 'react-native';

import { scanEndpoint } from './ProxyScanner';

const INTERNET_PROBE_URL = 'https://www.gstatic.com/generate_204';
const PROBE_TIMEOUT_MS = 6_000;

export type ServerHealth = {
  ok: boolean;
  /** HTTP status, or null when the request itself failed. */
  status: number | null;
  version: string | null;
  provider: string | null;
  model: string | null;
  /** Label reading possible (Gemini or Claude); null when unknown. */
  scan: boolean | null;
};

function withTimeout(): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

export async function probeInternet(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const { signal, done } = withTimeout();
  try {
    await fetch(`${INTERNET_PROBE_URL}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal,
      ...(Platform.OS === 'web' ? { mode: 'no-cors' as const } : {}),
    });
    return true;
  } catch {
    return false;
  } finally {
    done();
  }
}

/** `/health` next to the scan endpoint (…/scan → …/health). */
export function healthEndpoint(): string | null {
  const endpoint = scanEndpoint();
  return endpoint ? endpoint.replace(/\/scan\/?$/, '/health') : null;
}

export async function probeServer(): Promise<ServerHealth> {
  const url = healthEndpoint();
  const empty: ServerHealth = { ok: false, status: null, version: null, provider: null, model: null, scan: null };
  if (!url) return empty;
  const { signal, done } = withTimeout();
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', signal });
    if (!response.ok) return { ...empty, status: response.status };
    const body = (await response.json().catch(() => ({}))) as Partial<{
      version: string;
      provider: string | null;
      model: string | null;
      scan: boolean;
    }>;
    return {
      ok: true,
      status: response.status,
      version: typeof body.version === 'string' ? body.version : null,
      provider: body.provider ?? null,
      model: body.model ?? null,
      scan: typeof body.scan === 'boolean' ? body.scan : body.provider ? body.provider !== 'groq' : null,
    };
  } catch {
    return empty;
  } finally {
    done();
  }
}
