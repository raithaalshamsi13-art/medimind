/**
 * Label-scanner contract.
 *
 * Two implementations, the pattern used everywhere else in `services/`:
 *   MockScanner    Demo Mode — fixed results for the three demo scenarios
 *                  (safe / expired / unreadable); no network, no key
 *   ProxyScanner   the real thing — posts the photo to the Railway server,
 *                  which holds the AI key and asks a vision model to read it
 *
 * Whatever comes back is validated with `scanResultSchema` before any screen
 * sees it. The reader is untrusted input, exactly like a form.
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

export type ScanRequest = {
  image: ScanImage;
  /** 'en' | 'ar' — the language for the reader's warnings. */
  language: 'en' | 'ar';
  /** Mock only: which demo scenario to play. */
  demoScenario?: DemoScenario;
};

export interface MedicationScannerService {
  readonly kind: 'mock' | 'ai';
  scan(request: ScanRequest): Promise<Result<ScanResult>>;
}
