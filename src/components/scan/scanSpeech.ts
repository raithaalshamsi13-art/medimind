/**
 * What the app says out loud after a scan — the reading, nothing more.
 *
 * The sentence is built only from what the reader returned: the name, the
 * dosage, how often, the instructions and the expiry date, each introduced by
 * its label. In Arabic the translated wording is used so the voice matches
 * the screen. Fields read with low confidence are followed by one reminder
 * to compare them with the pack. No advice is ever added.
 */

import { expiryStatus } from '@/domain/expiry';
import { displayField, isUncertain, needsNameConfirmation, type ScanResult } from '@/domain/scan';
import type { Language, TranslationKey } from '@/i18n';
import { formatIsoDate } from '@/lib/datetime';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const SPOKEN_FIELDS: readonly { field: 'dosage' | 'form' | 'activeIngredients' | 'frequency' | 'instructions'; label: TranslationKey }[] = [
  { field: 'dosage', label: 'detail.dosage' },
  { field: 'form', label: 'scan.form' },
  { field: 'activeIngredients', label: 'scan.activeIngredients' },
  { field: 'frequency', label: 'detail.howOften' },
  { field: 'instructions', label: 'detail.instructions' },
];

export function scanAnnouncement(result: ScanResult, t: T, language: Language, today: Date = new Date()): string {
  const parts: string[] = [];
  const nothingRead =
    result.rawText.trim().length === 0 &&
    result.fields.name === null &&
    result.fields.dosage === null &&
    result.fields.frequency === null;

  if (nothingRead) return t('voice.scanUnreadable');

  parts.push(t('voice.scanIntro'));

  const name = displayField(result, 'name', language);
  if (name && !needsNameConfirmation(result)) {
    parts.push(t('voice.scanName', { name }));
  } else if (name) {
    parts.push(t('voice.scanName', { name }));
    parts.push(t('voice.scanNameUnknown'));
  } else {
    parts.push(t('voice.scanNameUnknown'));
  }

  for (const { field, label } of SPOKEN_FIELDS) {
    const value = displayField(result, field, language);
    if (value) parts.push(t('voice.scanField', { label: t(label), value }));
  }

  if (result.fields.expirationDate) {
    parts.push(t('voice.scanField', { label: t('detail.expiryDate'), value: formatIsoDate(result.fields.expirationDate) }));
    if (expiryStatus(result.fields.expirationDate, today)?.state === 'EXPIRED') parts.push(t('voice.scanExpired'));
  }

  const anyUncertain = (['name', 'dosage', 'frequency', 'instructions', 'expirationDate'] as const).some((f) =>
    isUncertain(result, f),
  );
  if (anyUncertain) parts.push(t('voice.scanCheck'));

  return parts.join(' ');
}
