/**
 * Translation helpers for values that are not plain strings: domain enums,
 * counts, times, and messages produced by the domain layer in English.
 */

import type { AvatarColor, BloodType, FamilyMember, Gender, Relationship } from '@/domain/familyMember';
import type { ConditionType, HealthCondition } from '@/domain/healthCondition';
import type { ExpiryStatus } from '@/domain/expiry';
import type { MedicationForm, MedicationKind, SafetyStatus } from '@/domain/medication';
import type { DoseStatus, Reminder, Weekday } from '@/domain/reminder';
import {
  FREQUENCY_PRESET_LABELS,
  parseFrequencyChoice,
  type DosageUnit,
  type FrequencyPreset,
  type InstructionOption,
} from '@/domain/medicationOptions';

import { en } from './en';
import { getLanguage, translate, type Language, type TranslationKey, type TranslationParams } from './index';

type T = (key: TranslationKey, params?: TranslationParams) => string;

// ---------------------------------------------------------------------------
// Enum labels
// ---------------------------------------------------------------------------

export const kindLabel = (t: T, kind: MedicationKind) => t(`kind.${kind}`);
export const medicationFormLabel = (t: T, form: MedicationForm) => t(`medForm.${form}`);
export const unitLabel = (t: T, unit: DosageUnit) => t(`unit.${unit}`);
export const frequencyPresetLabel = (t: T, preset: FrequencyPreset) => t(`freq.${preset}`);
export const instructionLabel = (t: T, option: InstructionOption) => t(`instr.${option}`);
export const conditionTypeLabel = (t: T, type: ConditionType) => t(`condition.${type}`);
export const genderLabel = (t: T, gender: Gender) => t(`gender.${gender}`);
export const avatarColorLabel = (t: T, color: AvatarColor) => t(`avatar.${color}`);
export const doseStatusLabel = (t: T, status: DoseStatus) => t(`doseStatus.${status}`);
export const weekdayLabel = (t: T, day: Weekday) => t(`weekday.${day}`);
export const safetyStatusLabel = (t: T, status: SafetyStatus) => t(`safety.${status}`);

export function bloodTypeLabelT(t: T, bloodType: BloodType): string {
  return bloodType === 'UNKNOWN' ? t('bloodType.UNKNOWN') : bloodType.replace('-', '−');
}

/** "Mother", or the custom wording, or "Me" — in the current language. */
export function relationshipLabelT(
  t: T,
  member: Pick<FamilyMember, 'relationship' | 'customRelationship'>,
): string {
  if (member.relationship === 'OTHER' && member.customRelationship) return member.customRelationship;
  return t(`relationship.${member.relationship as Relationship}`);
}

/** "High blood pressure" (translated) or the custom name. */
export function conditionNameT(t: T, condition: Pick<HealthCondition, 'type' | 'customName'>): string {
  if (condition.type === 'OTHER' && condition.customName) return condition.customName;
  return t(`condition.${condition.type}`);
}

/** The example placeholder for a condition's reading field, or null. */
export function conditionHintT(t: T, type: ConditionType): string | null {
  if (type === 'ARTHRITIS' || type === 'OTHER') return null;
  return t(`conditionHint.${type}`);
}

/** "My medicines" / "Fatima’s medicines" in the current language. */
export function possessiveT(
  t: T,
  member: Pick<FamilyMember, 'name' | 'isSelf'>,
  noun: 'medicines' | 'schedule' | 'healthConditions' | 'healthProfile',
): string {
  return member.isSelf ? t(`poss.my.${noun}`) : t(`poss.of.${noun}`, { name: member.name });
}

// ---------------------------------------------------------------------------
// Counts, times, dates
// ---------------------------------------------------------------------------

type CountKey =
  | 'common.medicinesCount'
  | 'common.conditionsCount'
  | 'common.dosesCount'
  | 'family.healthConditionsN'
  | 'medicines.saved'
  | 'home.medicineSaved';

/** Picks the `_one` / `_other` form. */
export function tCount(t: T, key: CountKey, count: number): string {
  const suffix = count === 1 ? '_one' : '_other';
  return t(`${key}${suffix}` as TranslationKey, { count });
}

/** "8:00 AM" / "8:00 ص" from "HH:mm". */
export function formatTime12(t: T, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const hour12 = ((h ?? 0) + 11) % 12 + 1;
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${(h ?? 0) < 12 ? t('time.am') : t('time.pm')}`;
}

/** "8:00 AM and 8:00 PM" in the current language. */
export function describeTimesT(t: T, times: string[]): string {
  const pretty = times.map((time) => formatTime12(t, time));
  if (pretty.length <= 1) return pretty.join('');
  return `${pretty.slice(0, -1).join(', ')} ${t('common.and')} ${pretty[pretty.length - 1]}`;
}

/** "Every day" / "Mon, Wed and Fri" in the current language. */
export function describeDaysT(t: T, reminder: Pick<Reminder, 'frequency' | 'days'>): string {
  if (reminder.frequency === 'DAILY' || reminder.days.length === 7) return t('days.everyDay');
  const labels = reminder.days.map((day) => weekdayLabel(t, day));
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} ${t('common.and')} ${labels[labels.length - 1]}`;
}

/** The expiry badge text in the current language. */
export function expiryLabelT(t: T, status: ExpiryStatus): string {
  if (status.state === 'EXPIRED') {
    const ago = -status.daysUntil;
    return ago === 1 ? t('expiry.expiredYesterday') : t('expiry.expiredDaysAgo', { n: ago });
  }
  if (status.state === 'EXPIRING_SOON') {
    if (status.daysUntil === 0) return t('expiry.today');
    if (status.daysUntil === 1) return t('expiry.tomorrow');
    return t('expiry.inDays', { n: status.daysUntil });
  }
  return t('expiry.ok');
}

/**
 * A stored frequency string shown in the current language when it matches a
 * preset ("Twice daily" → "مرتان يوميًا"); anything else is shown as recorded.
 */
export function frequencyDisplayT(t: T, frequency: string | null): string | null {
  if (!frequency) return null;
  const choice = parseFrequencyChoice(frequency);
  if (choice.preset === 'OTHER' || choice.preset === null) return frequency;
  if (choice.preset === 'EVERY_HOURS') return t('freq.everyNHours', { n: choice.hours });
  return frequencyPresetLabel(t, choice.preset);
}

/** Sanity: every preset has an English label (keeps the domain and i18n aligned). */
export const FREQUENCY_PRESET_KEYS = Object.keys(FREQUENCY_PRESET_LABELS) as FrequencyPreset[];

// ---------------------------------------------------------------------------
// Messages produced in English by the domain / error layers
// ---------------------------------------------------------------------------

let reverseIndex: Map<string, TranslationKey> | null = null;

function englishIndex(): Map<string, TranslationKey> {
  if (reverseIndex) return reverseIndex;
  reverseIndex = new Map();
  for (const [key, value] of Object.entries(en) as [TranslationKey, string][]) {
    if (!reverseIndex.has(value)) reverseIndex.set(value, key);
  }
  return reverseIndex;
}

/**
 * Translate a message that was produced in English somewhere the language is
 * not known (Zod schemas, the error catalogue, repositories). Unknown text —
 * including anything the user typed — is returned unchanged.
 */
export function localizeMessage(text: string, language: Language = getLanguage()): string {
  if (language === 'en') return text;
  const key = englishIndex().get(text);
  return key ? translate(language, key) : text;
}
