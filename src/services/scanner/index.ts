/**
 * Scanner factory — the only place that decides which reader runs.
 *
 *   Demo Mode on, or no server configured  → MockScanner
 *   otherwise                              → ProxyScanner (vision model via Railway)
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
  if (!demoMode && isRealScannerAvailable()) {
    proxy ??= new ProxyScanner();
    return proxy;
  }
  return mock;
}

export type { MedicationScannerService, ScanImage, ScanRequest } from './MedicationScannerService';
export { MockScanner } from './MockScanner';
export { ProxyScanner } from './ProxyScanner';
