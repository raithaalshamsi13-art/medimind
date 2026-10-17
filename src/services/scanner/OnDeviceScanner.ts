/**
 * The on-device reader: Apple's Vision framework recognises the printed text
 * on the phone itself (`modules/label-ocr`), and `extractFromLines` picks out
 * the fields from those words. No server, no AI key, no internet.
 *
 * Only available in the MediMind development build on iOS (Expo Go cannot
 * load custom native code). The factory checks `isLabelOcrAvailable()`.
 *
 * Honest scope: this reads printed words. It does not know what a medicine
 * is, whether it is genuine, safe, or how much to take — and the result
 * screen says so. Translation into Arabic is not available on-device; the
 * reading is shown as printed.
 */

import { extractFromLines } from '@/domain/labelText';
import type { OcrLine } from '../../../modules/label-ocr';
import { groundResult, type ScanResult } from '@/domain/scan';
import { tNow } from '@/i18n';
import { appError, toAppError } from '@/lib/errors';
import { fail, ok, type Result } from '@/lib/result';

import { isLabelOcrAvailable, recognizeLabelText, supportedOcrLanguages } from '../../../modules/label-ocr';
import type { MedicationScannerService, ScanRequest } from './MedicationScannerService';

/** Vision language tags to ask for, by app language (filtered to what the phone supports). */
function recognitionLanguages(language: 'en' | 'ar'): string[] {
  const supported = supportedOcrLanguages();
  const wanted = language === 'ar' ? ['ar-SA', 'ar', 'en-US', 'en-GB'] : ['en-US', 'en-GB'];
  const available = wanted.filter((tag) => supported.includes(tag));
  return available.length > 0 ? available : ['en-US'];
}

export class OnDeviceScanner implements MedicationScannerService {
  readonly kind = 'device' as const;

  async scan(request: ScanRequest): Promise<Result<ScanResult>> {
    if (!isLabelOcrAvailable()) {
      return fail(appError('SCANNER_NOT_CONFIGURED', 'on-device OCR module missing'));
    }
    try {
      // Every photo is read, then the lines are stacked photo under photo
      // (each photo's `y` offset by its index) so the extractor sees one
      // long label: the tallest text anywhere is the name, the first EXP
      // marker wins, and the raw text lists every photo in order.
      const languages = recognitionLanguages(request.language);
      const lines: OcrLine[] = [];
      for (const [index, image] of request.images.entries()) {
        const found = await recognizeLabelText(image.uri, languages);
        for (const line of found) lines.push({ ...line, y: line.y + index });
      }
      const result = extractFromLines(lines);
      // Translate the extractor's warning codes into sentences for the screen.
      const warnings = result.warnings.map((code) =>
        code === 'NO_TEXT' ? tNow('scan.warn.noText') : code === 'LOW_QUALITY' ? tNow('scan.warn.lowQuality') : code,
      );
      // Every field was copied from the text, so grounding is a no-op in
      // practice — it stays as the single rule for all readers.
      return ok(
        groundResult(
          { ...result, warnings },
          {
            nameNotOnLabel: tNow('scan.ground.name'),
            dosageNotOnLabel: tNow('scan.ground.dosage'),
            expiryNotOnLabel: tNow('scan.ground.expiry'),
          },
        ),
      );
    } catch (error) {
      return fail(toAppError(error, 'SCAN_DEVICE_ERROR'));
    }
  }
}
