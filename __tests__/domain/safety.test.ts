/**
 * The safety engine (CHECK). Pure and date-driven, so every branch is pinned
 * to a fixed "today".
 */

import { evaluateSafety, REVIEW_CONFIDENCE } from '@/domain/safety';

const TODAY = new Date(2026, 8, 19, 10, 0); // 19 Sep 2026

const complete = {
  expirationDate: '2028-01-01',
  dosage: '500 mg',
  frequency: 'Twice daily',
  source: 'MANUAL' as const,
  scanConfidence: null,
};

describe('evaluateSafety', () => {
  it('is SAFE when in date and the key details are recorded', () => {
    expect(evaluateSafety(complete, TODAY)).toEqual({ status: 'SAFE', reasons: [] });
  });

  it('notes a missing expiry date without flagging the medicine', () => {
    expect(evaluateSafety({ ...complete, expirationDate: null }, TODAY)).toEqual({
      status: 'SAFE',
      reasons: ['NO_EXPIRY'],
    });
  });

  it('is EXPIRED the day after the expiry date, whatever else is missing', () => {
    expect(evaluateSafety({ ...complete, expirationDate: '2026-09-18', dosage: null }, TODAY)).toEqual({
      status: 'EXPIRED',
      reasons: ['EXPIRED'],
    });
    expect(evaluateSafety({ ...complete, expirationDate: '2026-09-19' }, TODAY).status).toBe('EXPIRING_SOON');
  });

  it('is EXPIRING_SOON inside the 30-day window', () => {
    expect(evaluateSafety({ ...complete, expirationDate: '2026-10-10' }, TODAY)).toEqual({
      status: 'EXPIRING_SOON',
      reasons: ['EXPIRING_SOON'],
    });
  });

  it('needs review when dosage or frequency is missing', () => {
    expect(evaluateSafety({ ...complete, dosage: null }, TODAY)).toEqual({
      status: 'NEEDS_REVIEW',
      reasons: ['NO_DOSAGE'],
    });
    expect(evaluateSafety({ ...complete, frequency: null }, TODAY).reasons).toEqual(['NO_FREQUENCY']);
  });

  it('needs review when a scan was read with low confidence', () => {
    const scanned = { ...complete, source: 'SCAN' as const, scanConfidence: REVIEW_CONFIDENCE - 0.01 };
    expect(evaluateSafety(scanned, TODAY)).toEqual({ status: 'NEEDS_REVIEW', reasons: ['LOW_SCAN_CONFIDENCE'] });
    expect(evaluateSafety({ ...scanned, scanConfidence: REVIEW_CONFIDENCE }, TODAY).status).toBe('SAFE');
  });

  it('ignores scan confidence for a medicine entered by hand', () => {
    expect(evaluateSafety({ ...complete, scanConfidence: 0.1 }, TODAY).status).toBe('SAFE');
  });

  it('lists every reason, review first, then the soft expiry warning', () => {
    const result = evaluateSafety(
      { expirationDate: '2026-10-01', dosage: null, frequency: null, source: 'SCAN', scanConfidence: 0.3 },
      TODAY,
    );
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasons).toEqual(['LOW_SCAN_CONFIDENCE', 'NO_DOSAGE', 'NO_FREQUENCY', 'EXPIRING_SOON']);
  });
});
