/**
 * The real scanner: sends the photo to the MediMind API server (`server/`,
 * on Railway), which asks a vision model (Gemini by default) to transcribe
 * the label and pick out the fields. The API key never leaves the server.
 *
 * PRIVACY: exactly one photo is sent, and nothing else — no name, no account
 * id, no other medicines. The server does not store the image.
 *
 * FAILURES are named precisely (see `scanErrors.ts`): a request that never
 * got an answer is followed by two quick probes so the screen can say "no
 * internet" or "the server is not reachable" instead of guessing.
 */

import { env } from '@/config/env';
import { applyConflicts, groundResult, scanResultSchema, type ScanResult } from '@/domain/scan';
import { tNow } from '@/i18n';
import { appError, toAppError } from '@/lib/errors';
import { fail, ok, type Result } from '@/lib/result';

import { probeInternet, probeServer } from './connectivity';
import type { MedicationScannerService, ScanRequest } from './MedicationScannerService';
import { classifyHttpFailure, classifyTransportFailure } from './scanErrors';

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
      return fail(appError('SCANNER_NOT_CONFIGURED', 'no scan endpoint configured'));
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
          // One medicine, several sides: the server hands every photo to the
          // vision model in one call so it can combine them.
          images: request.images.map((image) => ({ data: image.base64, mimeType: image.mimeType })),
          language: request.language,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return fail(appError(classifyHttpFailure(response.status, detail), `scan server responded ${response.status}: ${detail.slice(0, 200)}`));
      }

      const payload: unknown = await response.json();
      const parsed = scanResultSchema.safeParse((payload as { result?: unknown })?.result ?? payload);
      if (!parsed.success) {
        return fail(appError('SCAN_SERVER_ERROR', `scan server returned an unexpected shape: ${parsed.error.message.slice(0, 200)}`));
      }
      // Cross-check the fields against the transcription: anything the reader
      // did not actually read is flagged, never trusted.
      return ok(
        groundResult(applyConflicts(parsed.data), {
          nameNotOnLabel: tNow('scan.ground.name'),
          dosageNotOnLabel: tNow('scan.ground.dosage'),
          expiryNotOnLabel: tNow('scan.ground.expiry'),
        }),
      );
    } catch (error) {
      // No HTTP answer at all: timed out, offline, server down, or the
      // connection was dropped. Find out which before telling the user.
      const aborted = error instanceof Error && error.name === 'AbortError';
      const probes = aborted
        ? { internet: true, server: true }
        : { internet: await probeInternet(), server: (await probeServer()).ok };
      return fail(toAppError(error, classifyTransportFailure(probes, aborted)));
    } finally {
      clearTimeout(timer);
    }
  }
}
