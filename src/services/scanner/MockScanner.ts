/**
 * Demo Mode scanner (Phase 19): returns one of three fixed results after a
 * short pause, so the demonstration never depends on a network, a key or the
 * lighting in the room. The photo the user took is still shown beside the
 * text, so the flow looks and feels like the real one.
 */

import { demoScanResult } from '@/domain/scan';
import { ok, type Result } from '@/lib/result';
import type { ScanResult } from '@/domain/scan';

import type { MedicationScannerService, ScanRequest } from './MedicationScannerService';

const THINK_MS = 900;

export class MockScanner implements MedicationScannerService {
  readonly kind = 'mock' as const;

  async scan(request: ScanRequest): Promise<Result<ScanResult>> {
    await new Promise((resolve) => setTimeout(resolve, THINK_MS));
    return ok(demoScanResult(request.demoScenario ?? 'SAFE'));
  }
}
