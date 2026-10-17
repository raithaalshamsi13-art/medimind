/**
 * Label-scanner contract.
 *
 * Three implementations, the pattern used everywhere else in `services/`:
 *   MockScanner      Demo Mode — fixed results for the three demo scenarios
 *                    (safe / expired / unreadable); no network, no key
 *   OnDeviceScanner  Apple Vision on the iPhone (development build only)
 *   ProxyScanner     the real thing — posts the photo(s) to the MediMind
 *                    server, which holds the AI key and asks a vision model
 *
 * A request carries ONE medicine as one or more photos (front, back, side…)
 * and every reader must combine them into ONE reading — or say that the
 * photos show different medicines. Whatever comes back is validated with
 * `scanResultSchema` before any screen sees it. The reader is untrusted
 * input, exactly like a form.
 */

import type { DemoScenario, ScanResult } from '@/domain/scan';
import type { Result } from '@/lib/result';

export type ScanImage = {
  /** Local URI (file:// on the phone, blob:/data: on web) for display and storage. */
  uri: string;
  /** JPEG/PNG bytes, base64 without a data: prefix. */
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
  width?: number;
  height?: number;
};

/** Photos per scan: enough for every side of a pack, inside the server's body limit. */
export const MAX_SCAN_PHOTOS = 5;

export type ScanRequest = {
  /** One medicine, one or more photos of it. Never empty. */
  images: ScanImage[];
  /** 'en' | 'ar' — the language for the reader's warnings and translation. */
  language: 'en' | 'ar';
  /** Mock only: which demo scenario to play. */
  demoScenario?: DemoScenario;
};

export interface MedicationScannerService {
  readonly kind: 'mock' | 'device' | 'ai';
  scan(request: ScanRequest): Promise<Result<ScanResult>>;
}
