/**
 * Make text sound right when spoken.
 *
 * Two things trip up every phone voice on a medicine label:
 *   - units: "500 mg" is read as "five hundred em gee" (or spelled out), so
 *     units are expanded to words — milligrams, micrograms, millilitres…
 *   - CAPITALS: "PANADOL EXTRA" is spelled letter by letter, so all-capital
 *     words become capitalised words ("Panadol Extra"), which the voice then
 *     pronounces as a name.
 * Nothing else is changed: numbers, names and wording stay as printed.
 */

import type { Language } from '@/i18n';

type UnitWords = { one: string; many: string };

const UNITS: Record<Language, Record<string, UnitWords>> = {
  en: {
    mg: { one: 'milligram', many: 'milligrams' },
    mcg: { one: 'microgram', many: 'micrograms' },
    µg: { one: 'microgram', many: 'micrograms' },
    μg: { one: 'microgram', many: 'micrograms' },
    g: { one: 'gram', many: 'grams' },
    kg: { one: 'kilogram', many: 'kilograms' },
    ml: { one: 'millilitre', many: 'millilitres' },
    l: { one: 'litre', many: 'litres' },
    iu: { one: 'international unit', many: 'international units' },
    '%': { one: 'percent', many: 'percent' },
    hr: { one: 'hour', many: 'hours' },
    hrs: { one: 'hours', many: 'hours' },
  },
  ar: {
    mg: { one: 'ملليغرام', many: 'ملليغرام' },
    mcg: { one: 'ميكروغرام', many: 'ميكروغرام' },
    µg: { one: 'ميكروغرام', many: 'ميكروغرام' },
    μg: { one: 'ميكروغرام', many: 'ميكروغرام' },
    g: { one: 'غرام', many: 'غرام' },
    kg: { one: 'كيلوغرام', many: 'كيلوغرام' },
    ml: { one: 'ملليلتر', many: 'ملليلتر' },
    l: { one: 'لتر', many: 'لتر' },
    iu: { one: 'وحدة دولية', many: 'وحدة دولية' },
    '%': { one: 'بالمئة', many: 'بالمئة' },
    hr: { one: 'ساعة', many: 'ساعات' },
    hrs: { one: 'ساعات', many: 'ساعات' },
    ملغ: { one: 'ملليغرام', many: 'ملليغرام' },
    مل: { one: 'ملليلتر', many: 'ملليلتر' },
  },
};

const PER: Record<Language, string> = { en: 'per', ar: 'لكل' };

/** "500 mg", "2.5ml", "10 mg/5 ml" → words. */
function expandUnits(text: string, language: Language): string {
  const units = UNITS[language];
  // Longest first so "mcg" wins over "g"; "%" needs no escaping in a group.
  const keys = Object.keys(units)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const pattern = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s?(${keys})(?![\\p{L}])`, 'giu');
  const withUnits = text.replace(pattern, (_m, amount: string, unit: string) => {
    const words = units[unit.toLowerCase()] ?? units[unit];
    if (!words) return `${amount} ${unit}`;
    const n = Number(amount.replace(',', '.'));
    return `${amount} ${n === 1 ? words.one : words.many}`;
  });
  // "10 milligrams/5 millilitres" → "10 milligrams per 5 millilitres"
  return withUnits.replace(/(\p{L})\s?\/\s?(\d)/gu, `$1 ${PER[language]} $2`);
}

/** "PANADOL EXTRA 500" → "Panadol Extra 500"; short all-caps tokens (IU, mg…) are left alone. */
function softenCapitals(text: string): string {
  return text.replace(/\b[A-Z][A-Z'’-]{2,}\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());
}

export function speakable(text: string, language: Language): string {
  return expandUnits(softenCapitals(text), language);
}
