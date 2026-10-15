/**
 * Scanner factory — the only place that decides which reader runs.
 *
 *   Demo Mode on   → MockScanner: fixed example readings, chosen on screen.
 *                    Never used for a real label without the screen saying so.
 *   Demo Mode off  → ProxyScanner: the photo goes to the MediMind server,
 *                    which runs a vision model on it. If no server address is
 *                    configured the scan fails with a clear message — it
 *                    never quietly falls back to an example.
 */

import { MockScanner } from './MockScanner';
import type { MedicationScannerService } from './MedicationScannerService';
import { ProxyScanner, scanEndpoint } from './ProxyScanner';

const mock = new MockScanner();
let proxy: ProxyScanner | null = null;

export function isRealScannerAvailable(): boolean {
  return scanEndpoint() !== null;
}

export function getScannerService(demoMode: boolean): MedicationScannerService {
  if (demoMode) return mock;
  proxy ??= new ProxyScanner();
  return proxy;
}

export type { MedicationScannerService, ScanImage, ScanRequest } from './MedicationScannerService';
export { MockScanner } from './MockScanner';
export { ProxyScanner } from './ProxyScanner';
