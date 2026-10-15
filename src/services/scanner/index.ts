/**
 * Scanner factory — the only place that decides which reader runs.
 *
 *   Demo Mode on                 → MockScanner: fixed example readings, chosen
 *                                  on screen. Never used without the screen
 *                                  saying so.
 *   iOS development build        → OnDeviceScanner: Apple Vision reads the
 *                                  printed text on the phone. No server, no
 *                                  key, no internet.
 *   otherwise, server configured → ProxyScanner: the photo goes to the
 *                                  MediMind server's vision model.
 *   otherwise                    → ProxyScanner reports SCANNER_NOT_CONFIGURED;
 *                                  it never quietly falls back to an example.
 */

import { isLabelOcrAvailable } from '../../../modules/label-ocr';
import type { MedicationScannerService } from './MedicationScannerService';
import { MockScanner } from './MockScanner';
import { OnDeviceScanner } from './OnDeviceScanner';
import { ProxyScanner, scanEndpoint } from './ProxyScanner';

const mock = new MockScanner();
let device: OnDeviceScanner | null = null;
let proxy: ProxyScanner | null = null;

export type ReaderKind = 'mock' | 'device' | 'ai' | 'none';

export function isRealScannerAvailable(): boolean {
  return isLabelOcrAvailable() || scanEndpoint() !== null;
}

export function isOnDeviceReaderAvailable(): boolean {
  return isLabelOcrAvailable();
}

/** Which reader a scan would use right now, for the banner and Settings. */
export function readerKind(demoMode: boolean): ReaderKind {
  if (demoMode) return 'mock';
  if (isLabelOcrAvailable()) return 'device';
  if (scanEndpoint() !== null) return 'ai';
  return 'none';
}

export function getScannerService(demoMode: boolean): MedicationScannerService {
  if (demoMode) return mock;
  if (isLabelOcrAvailable()) {
    device ??= new OnDeviceScanner();
    return device;
  }
  proxy ??= new ProxyScanner();
  return proxy;
}

export type { MedicationScannerService, ScanImage, ScanRequest } from './MedicationScannerService';
export { MockScanner } from './MockScanner';
export { OnDeviceScanner } from './OnDeviceScanner';
export { ProxyScanner } from './ProxyScanner';
