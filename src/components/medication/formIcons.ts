/**
 * One icon per medicine form, used on chips, cards and the detail screen.
 * Icons always sit next to the written form name — never alone.
 */

import type { Ionicons } from '@expo/vector-icons';

import { MEDICATION_FORM_LABELS, MEDICATION_FORMS, type MedicationForm } from '@/domain/medication';

import type { ChipOption } from '@/components/ui';

export type IconName = keyof typeof Ionicons.glyphMap;

export const MEDICATION_FORM_ICONS: Record<MedicationForm, IconName> = {
  TABLET: 'medical-outline',
  CAPSULE: 'bandage-outline',
  LIQUID: 'flask-outline',
  INHALER: 'cloud-outline',
  INJECTION: 'eyedrop-outline',
  CREAM: 'color-fill-outline',
  DROPS: 'water-outline',
  PATCH: 'square-outline',
  SPRAY: 'sparkles-outline',
  OTHER: 'medkit-outline',
};

/** Icon for a medicine whose form may not have been chosen. */
export function medicationIcon(form: MedicationForm | null): IconName {
  return form ? MEDICATION_FORM_ICONS[form] : 'medkit-outline';
}

export const MEDICATION_FORM_OPTIONS: readonly ChipOption<MedicationForm>[] = MEDICATION_FORMS.map(
  (form) => ({ value: form, label: MEDICATION_FORM_LABELS[form], icon: MEDICATION_FORM_ICONS[form] }),
);
