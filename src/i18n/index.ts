/**
 * Translations — English and Arabic.
 *
 * HOW IT WORKS
 * Every user-facing string lives in `en.ts` under a key; `ar.ts` must define
 * the same keys (TypeScript refuses a missing one). Components call `t(key)`
 * from `useT()`, which re-renders when the language setting changes.
 * Placeholders are `{name}` and filled from the `params` object.
 *
 * WHAT IS *NOT* TRANSLATED, ON PURPOSE
 *   - what the user typed: medicine names, notes, readings, custom wording
 *   - the text stored in the database for dosage / frequency / instructions.
 *     Chips show Arabic labels, but they still compose to the English wording
 *     the dose parser and the assistant understand ("Twice daily"). Screens
 *     that display a stored value first try to recognise it (see
 *     `domain/medicationOptions.ts`) and show the translated label; anything
 *     unrecognised is shown as recorded.
 *
 * RIGHT-TO-LEFT
 * Arabic flips the layout. On the web that is immediate (`dir="rtl"` on the
 * document). On the phone React Native needs a reload after
 * `I18nManager.forceRTL`, so `applyDirection` reports `needsReload` and the
 * Settings screen offers one.
 */

import { ar as dateFnsAr, enGB } from 'date-fns/locale';
import { DevSettings, I18nManager, Platform } from 'react-native';

import { useSettingsStore } from '@/stores/useSettingsStore';

import { ar } from './ar';
import { en } from './en';

export type Language = 'en' | 'ar';
export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;

export const LANGUAGES: readonly { code: Language; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
];

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, ar };

function fill(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Translate outside React (stores, services, notifications). */
export function translate(language: Language, key: TranslationKey, params?: TranslationParams): string {
  const dictionary = DICTIONARIES[language] ?? en;
  return fill(dictionary[key] ?? en[key] ?? key, params);
}

/** The current language from settings — for code that has no hook. */
export function getLanguage(): Language {
  return useSettingsStore.getState().language;
}

/** Translate with the current language, outside React. */
export function tNow(key: TranslationKey, params?: TranslationParams): string {
  return translate(getLanguage(), key, params);
}

export function isRTLLanguage(language: Language): boolean {
  return language === 'ar';
}

/** date-fns locale for formatting dates in the current language. */
export function getDateLocale() {
  return getLanguage() === 'ar' ? dateFnsAr : enGB;
}

/**
 * Point the layout engine in the right direction for `language`.
 * Returns whether the phone needs a reload for it to take effect.
 */
export function applyDirection(language: Language): { needsReload: boolean } {
  const rtl = isRTLLanguage(language);

  if (Platform.OS === 'web') {
    const doc = (globalThis as { document?: { documentElement: { dir: string; lang: string } } }).document;
    if (doc) {
      doc.documentElement.dir = rtl ? 'rtl' : 'ltr';
      doc.documentElement.lang = language;
    }
    return { needsReload: false };
  }

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(rtl);
  return { needsReload: I18nManager.isRTL !== rtl };
}

/** Reload the JavaScript bundle where that is possible (Expo Go / dev). */
export function reloadApp(): boolean {
  if (__DEV__ && typeof DevSettings.reload === 'function') {
    DevSettings.reload();
    return true;
  }
  return false;
}

/** The hook components use: `const { t, language, isRTL } = useT();` */
export function useT() {
  const language = useSettingsStore((state) => state.language);
  const t = (key: TranslationKey, params?: TranslationParams) => translate(language, key, params);
  return { t, language, isRTL: isRTLLanguage(language) };
}
