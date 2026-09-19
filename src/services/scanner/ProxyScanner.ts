/**
 * The real scanner: sends the photo to the MediMind API server (`server/`,
 * on Railway), which asks a vision model (Gemini by default) to transcribe
 * the label and pick out the fields. The API key never leaves the server.
 *
 * PRIVACY: exactly one photo is sent, and nothing else — no name, no account
 * id, no other medicines. The server does not store the image.
 */

import { env } from '@/config/env';
import { scanResultSchema, type ScanResult } from '@/domain/scan';
import { appError, toAppError } from '@/lib/errors';
import { fail, ok, type Result } from '@/lib/result';

import type { MedicationScannerService, ScanRequest } from './MedicationScannerService';

/** Vision calls are slower than chat; Railway's free tier may also be waking up. */
const REQUEST_TIMEOUT_MS = 60_000;

/** Derive `/scan` from the assistant endpoint when no dedicated one is set. */
export function scanEndpoint(): string | null {
  if (env.scanEndpoint) return env.scanEndpoint;
  if (env.assistantEndpoint) return env.assistantEndpoint.replace(/\/assistant\/?$/, '/scan');
  return null;
}

export class ProxyScanner implements MedicationScannerService {
  readonly kind = 'ai' as const;

  constructor(private readonly endpoint: string | null = scanEndpoint()) {}

  async scan(request: ScanRequest): Promise<Result<ScanResult>> {
    if (!this.endpoint) {
      return fail(appError('ASSISTANT_UNAVAILABLE', 'no scan endpoint configured'));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (env.assistantAccessKey) headers['x-app-key'] = env.assistantAccessKey;

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          image: request.image.base64,
          mimeType: request.image.mimeType,
          language: request.language,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return fail(appError('ASSISTANT_UNAVAILABLE', `scan server responded ${response.status}: ${detail.slice(0, 200)}`));
      }

      const payload: unknown = await response.json();
      const parsed = scanResultSchema.safeParse((payload as { result?: unknown })?.result ?? payload);
      if (!parsed.success) {
        return fail(appError('ASSISTANT_UNAVAILABLE', `scan server returned an unexpected shape: ${parsed.error.message.slice(0, 200)}`));
      }
      return ok(parsed.data);
    } catch (error) {
      if (error instanceof TypeError) return fail(toAppError(error, 'NETWORK_UNAVAILABLE'));
      return fail(toAppError(error, 'ASSISTANT_UNAVAILABLE'));
    } finally {
      clearTimeout(timer);
    }
  }
}
