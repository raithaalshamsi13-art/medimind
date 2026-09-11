import { EXPIRY_WARNING_DAYS, expiryStatus } from '@/domain/expiry';

const TODAY = new Date(2026, 8, 11, 15, 30); // 11 Sep 2026, mid-afternoon

describe('expiryStatus', () => {
  it('returns null for no date or a malformed date', () => {
    expect(expiryStatus(null, TODAY)).toBeNull();
    expect(expiryStatus('', TODAY)).toBeNull();
    expect(expiryStatus('30/04/2027', TODAY)).toBeNull();
    expect(expiryStatus('2027-02-30', TODAY)).toBeNull();
  });

  it('counts a medicine as in date on its expiry day, expired the day after', () => {
    expect(expiryStatus('2026-09-11', TODAY)).toMatchObject({
      state: 'EXPIRING_SOON',
      daysUntil: 0,
      label: 'Expires today',
    });
    expect(expiryStatus('2026-09-10', TODAY)).toMatchObject({
      state: 'EXPIRED',
      daysUntil: -1,
      label: 'Expired yesterday',
    });
    expect(expiryStatus('2026-09-01', TODAY)).toMatchObject({
      state: 'EXPIRED',
      daysUntil: -10,
      label: 'Expired 10 days ago',
    });
  });

  it('flags the warning window and nothing beyond it', () => {
    expect(expiryStatus('2026-09-12', TODAY)).toMatchObject({
      state: 'EXPIRING_SOON',
      label: 'Expires tomorrow',
    });
    expect(expiryStatus('2026-10-11', TODAY)).toMatchObject({
      state: 'EXPIRING_SOON',
      daysUntil: EXPIRY_WARNING_DAYS,
      label: `Expires in ${EXPIRY_WARNING_DAYS} days`,
    });
    expect(expiryStatus('2026-10-12', TODAY)).toMatchObject({ state: 'OK', label: 'In date' });
    expect(expiryStatus('2030-01-01', TODAY)?.state).toBe('OK');
  });

  it('ignores the time of day', () => {
    const lateTonight = new Date(2026, 8, 11, 23, 59);
    expect(expiryStatus('2026-09-11', lateTonight)?.daysUntil).toBe(0);
  });
});
