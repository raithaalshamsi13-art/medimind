/**
 * What the app says after a scan: the reading, in the app's language, and
 * nothing it did not read.
 */

import { scanAnnouncement } from '@/components/scan/scanSpeech';
import { demoScanResult, type ScanResult } from '@/domain/scan';
import { translate, type TranslationKey } from '@/i18n';

const TODAY = new Date(2026, 9, 15);
const tEn = (key: TranslationKey, params?: Record<string, string | number>) => translate('en', key, params);
const tAr = (key: TranslationKey, params?: Record<string, string | number>) => translate('ar', key, params);

describe('scanAnnouncement', () => {
  it('reads the name, dosage, frequency, instructions and expiry of a confident reading', () => {
    const spoken = scanAnnouncement(demoScanResult('SAFE', TODAY), tEn, 'en', TODAY);
    expect(spoken).toContain('Medicine name: Demo Medicine.');
    expect(spoken).toContain('Dosage: 500 mg.');
    expect(spoken).toContain('How often: Every 6 hours.');
    expect(spoken).toContain('Instructions: Do not take more than 8 tablets in 24 hours.');
    expect(spoken).toContain('Expiry date:');
    expect(spoken).not.toContain('expired');
    expect(spoken).not.toContain('check this');
  });

  it('warns about an expired reading, without advice', () => {
    const spoken = scanAnnouncement(demoScanResult('EXPIRED', TODAY), tEn, 'en', TODAY);
    expect(spoken).toContain('appears to be expired');
    expect(spoken).not.toMatch(/take it now|double/i);
  });

  it('says the label could not be read when nothing came back', () => {
    const empty: ScanResult = {
      ...demoScanResult('UNREADABLE', TODAY),
      rawText: '',
    };
    expect(scanAnnouncement(empty, tEn, 'en', TODAY)).toBe(tEn('voice.scanUnreadable'));
  });

  it('asks for the name when it was not read, and to check low-confidence fields', () => {
    const weak: ScanResult = {
      ...demoScanResult('SAFE', TODAY),
      confidence: { name: 0.5, dosage: 0.95, frequency: 0.9, instructions: 0.9, expirationDate: 0.9 },
    };
    const spoken = scanAnnouncement(weak, tEn, 'en', TODAY);
    expect(spoken).toContain('could not be read');
    expect(spoken).toContain('compare the details');
  });

  it('speaks the Arabic wording when the app is in Arabic', () => {
    const spoken = scanAnnouncement(demoScanResult('SAFE', TODAY, 'ar'), tAr, 'ar', TODAY);
    expect(spoken).toContain('دواء تجريبي');
    expect(spoken).toContain('500 ملغ');
    expect(spoken).not.toContain('Demo Medicine');
  });
});
