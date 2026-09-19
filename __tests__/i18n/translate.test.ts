/**
 * Translations: the Arabic dictionary is complete (TypeScript enforces it),
 * placeholders are filled, English messages from the domain layer translate
 * by lookup, and the label helpers pick the right words.
 */

import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import {
  describeTimesT,
  expiryLabelT,
  formatTime12,
  frequencyDisplayT,
  localizeMessage,
  possessiveT,
  tCount,
} from '@/i18n/labels';
import { translate, type TranslationKey } from '@/i18n';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => true,
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

const tEn = (key: TranslationKey, params?: Record<string, string | number>) => translate('en', key, params);
const tAr = (key: TranslationKey, params?: Record<string, string | number>) => translate('ar', key, params);

describe('dictionaries', () => {
  it('has an Arabic string for every English key, and none are empty', () => {
    for (const key of Object.keys(en) as TranslationKey[]) {
      expect(typeof ar[key]).toBe('string');
      expect(ar[key].trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(ar).length).toBe(Object.keys(en).length);
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as TranslationKey[]) {
      const inEnglish = placeholders(en[key]);
      const inArabic = placeholders(ar[key]);
      // Arabic never uses a placeholder English lacks (it would print as "{x}").
      for (const p of inArabic) expect(inEnglish).toContain(p);
      // Singular forms may drop the number ("دواء واحد"); every other key must match.
      if (!key.endsWith('_one')) expect(inArabic).toEqual(inEnglish);
    }
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(tEn('detail.deleteTitle', { name: 'Paracetamol' })).toBe('Delete Paracetamol?');
    expect(tAr('detail.deleteTitle', { name: 'Paracetamol' })).toBe('حذف Paracetamol؟');
    expect(tEn('detail.deleteTitle')).toBe('Delete {name}?');
  });
});

describe('localizeMessage', () => {
  it('translates English messages produced by the domain and error layers', () => {
    expect(localizeMessage('Please enter the name of the medicine.', 'ar')).toBe(ar['validation.medicineName']);
    expect(localizeMessage('That medicine could not be found. It may have already been deleted.', 'ar')).toBe(
      ar['error.NOT_FOUND'],
    );
    expect(localizeMessage('Only one profile can be “Me”. Choose another relationship.', 'ar')).toBe(
      ar['repo.onlyOneSelf'],
    );
  });

  it('leaves unknown text (e.g. what the user typed) unchanged, and is a no-op in English', () => {
    expect(localizeMessage('Take with food', 'ar')).toBe('Take with food');
    expect(localizeMessage('Please enter the name of the medicine.', 'en')).toBe(
      'Please enter the name of the medicine.',
    );
  });
});

describe('label helpers', () => {
  it('pluralises counts per language', () => {
    expect(tCount(tEn, 'common.medicinesCount', 1)).toBe('1 medicine');
    expect(tCount(tEn, 'common.medicinesCount', 3)).toBe('3 medicines');
    expect(tCount(tAr, 'common.medicinesCount', 1)).toBe('دواء واحد');
    expect(tCount(tAr, 'common.medicinesCount', 3)).toBe('3 أدوية');
  });

  it('formats times with the language’s AM/PM marker and Western digits', () => {
    expect(formatTime12(tEn, '20:00')).toBe('8:00 PM');
    expect(formatTime12(tAr, '20:00')).toBe('8:00 م');
    expect(describeTimesT(tEn, ['08:00', '20:00'])).toBe('8:00 AM and 8:00 PM');
    expect(describeTimesT(tAr, ['08:00', '20:00'])).toBe('8:00 ص و 8:00 م');
  });

  it('translates expiry states', () => {
    expect(expiryLabelT(tEn, { state: 'EXPIRED', daysUntil: -3, label: '' })).toBe('Expired 3 days ago');
    expect(expiryLabelT(tAr, { state: 'EXPIRED', daysUntil: -1, label: '' })).toBe('انتهى أمس');
    expect(expiryLabelT(tAr, { state: 'EXPIRING_SOON', daysUntil: 0, label: '' })).toBe('ينتهي اليوم');
    expect(expiryLabelT(tAr, { state: 'OK', daysUntil: 90, label: '' })).toBe('ساري الصلاحية');
  });

  it('shows a recognised stored frequency in the current language, and unknown wording as recorded', () => {
    expect(frequencyDisplayT(tAr, 'Twice daily')).toBe('مرتان يوميًا');
    expect(frequencyDisplayT(tAr, 'Every 8 hours')).toBe('كل 8 ساعات');
    expect(frequencyDisplayT(tAr, 'Two at night')).toBe('Two at night');
    expect(frequencyDisplayT(tEn, null)).toBeNull();
  });

  it('builds possessives per language', () => {
    expect(possessiveT(tEn, { name: 'Fatima', isSelf: false }, 'medicines')).toBe('Fatima’s medicines');
    expect(possessiveT(tAr, { name: 'Fatima', isSelf: false }, 'medicines')).toBe('أدوية Fatima');
    expect(possessiveT(tAr, { name: 'Omar', isSelf: true }, 'medicines')).toBe('أدويتي');
  });
});
