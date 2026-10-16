/**
 * Turn what came back from the scan request into one precise error, so the
 * screen can say what actually happened: no internet, server not reachable,
 * app key rejected, AI key rejected on the server, busy, too large, timed
 * out, or a genuine server fault. "The label could not be read" is reserved
 * for a reading that came back empty — that is not an error at all.
 */

import type { AppErrorCode } from '@/lib/errors';

/** Server error codes (see `server/src/index.ts`) → app error codes. */
const SERVER_CODES: Record<string, AppErrorCode> = {
  APP_KEY_REJECTED: 'SCAN_APP_KEY_REJECTED',
  PROVIDER_KEY_INVALID: 'SCAN_PROVIDER_KEY_INVALID',
  NO_VISION_PROVIDER: 'SCAN_NO_VISION',
  NO_PROVIDER: 'SCAN_NO_VISION',
  RATE_LIMITED: 'SCAN_RATE_LIMITED',
  PROVIDER_RATE_LIMITED: 'SCAN_RATE_LIMITED',
  PROVIDER_BUSY: 'SCAN_PROVIDER_BUSY',
  IMAGE_TOO_LARGE: 'SCAN_IMAGE_TOO_LARGE',
  PROVIDER_TIMEOUT: 'SCAN_TIMEOUT',
  PROVIDER_UNAVAILABLE: 'SCAN_SERVER_ERROR',
  BAD_REPLY: 'SCAN_SERVER_ERROR',
  BAD_REQUEST: 'SCAN_SERVER_ERROR',
  SERVER_ERROR: 'SCAN_SERVER_ERROR',
};

/** Pull `{ code }` out of a JSON error body, if there is one. */
export function serverErrorCode(bodyText: string): string | null {
  try {
    const parsed = JSON.parse(bodyText) as { code?: unknown };
    return typeof parsed.code === 'string' ? parsed.code : null;
  } catch {
    return null;
  }
}

/** An HTTP failure from the scan endpoint → the app error to show. */
export function classifyHttpFailure(status: number, bodyText: string): AppErrorCode {
  const code = serverErrorCode(bodyText);
  if (code && SERVER_CODES[code]) return SERVER_CODES[code];
  if (status === 401) return 'SCAN_APP_KEY_REJECTED';
  if (status === 404) return 'SERVER_UNREACHABLE'; // nothing deployed at this address, or an old server without /scan
  if (status === 413) return 'SCAN_IMAGE_TOO_LARGE';
  if (status === 429) return 'SCAN_RATE_LIMITED';
  if (status === 501) return 'SCAN_NO_VISION';
  if (status === 503) return 'SCAN_PROVIDER_KEY_INVALID';
  if (status === 504) return 'SCAN_TIMEOUT';
  if (status >= 500) return 'SCAN_SERVER_ERROR';
  if (status === 502 || status === 400) return 'SCAN_SERVER_ERROR';
  return 'SCAN_SERVER_ERROR';
}

/**
 * The request itself failed (no HTTP status). Decide between "no internet"
 * and "the server is not reachable" from two quick probes.
 */
export function classifyTransportFailure(probes: { internet: boolean; server: boolean }, aborted: boolean): AppErrorCode {
  if (aborted) return 'SCAN_TIMEOUT';
  if (!probes.internet) return 'NETWORK_UNAVAILABLE';
  if (!probes.server) return 'SERVER_UNREACHABLE';
  // Internet and server both answer, yet the scan request died: almost always
  // the server dropped the connection (body too large for its proxy).
  return 'SCAN_SERVER_ERROR';
}
