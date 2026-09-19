/**
 * The personal-health-profile fields — date of birth, gender, height, weight,
 * blood type — shared by the sign-up step and the family member form so the
 * two can never ask differently.
 *
 * Everything is optional. Height and weight are metric (cm / kg) only, to
 * keep the form short; the app never calculates anything from them.
 */

import { View } from 'react-native';

import { AppText, ChoiceChips, DateField, TextField, type ChipOption } from '@/components/ui';
import {
  BLOOD_TYPES,
  GENDERS,
  type BloodType,
  type Gender,
  type HealthProfileFormValues,
} from '@/domain/familyMember';
import { useT } from '@/i18n';
import { bloodTypeLabelT, genderLabel, localizeMessage } from '@/i18n/labels';
import { useTheme } from '@/theme/ThemeContext';

type Field = keyof HealthProfileFormValues;


export type HealthProfileFieldsProps = {
  values: HealthProfileFormValues;
  errors: Partial<Record<Field, string>>;
  /** Receives the changed field(s); the owner merges them into its state. */
  onChange: (patch: Partial<HealthProfileFormValues>) => void;
  /** "your" for the account holder, otherwise "their". */
  possessive?: 'your' | 'their';
};

export function HealthProfileFields({
  values,
  errors,
  onChange: emit,
  possessive = 'your',
}: HealthProfileFieldsProps) {
  const theme = useTheme();
  const { t } = useT();
  const genderOptions: readonly ChipOption<Gender>[] = GENDERS.map((gender) => ({
    value: gender,
    label: genderLabel(t, gender),
  }));
  const bloodTypeOptions: readonly ChipOption<BloodType>[] = BLOOD_TYPES.map((bloodType) => ({
    value: bloodType,
    label: bloodTypeLabelT(t, bloodType),
  }));
  const onChange = <K extends Field>(field: K, value: HealthProfileFormValues[K]) =>
    emit({ [field]: value } as Partial<HealthProfileFormValues>);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <DateField
        label={t('profile.dateOfBirth')}
        value={values.dateOfBirth}
        onChange={(dateOfBirth) => onChange('dateOfBirth', dateOfBirth)}
        error={errors.dateOfBirth}
        helper={possessive === 'your' ? t('profile.dateOfBirthHelperYour') : t('profile.dateOfBirthHelperTheir')}
        maximumDate={new Date()}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color={errors.gender ? 'dangerText' : 'textSecondary'}>
          {t('profile.gender')}
        </AppText>
        <ChoiceChips
          options={genderOptions}
          value={values.gender || null}
          onChange={(gender) => onChange('gender', gender ?? '')}
          accessibilityLabel={t('profile.gender')}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <TextField
          label={t('profile.heightCm')}
          value={values.heightCm}
          onChangeText={(heightCm) => onChange('heightCm', heightCm)}
          placeholder={t('profile.heightPlaceholder')}
          keyboardType="decimal-pad"
          error={errors.heightCm}
          style={{ flex: 1 }}
        />
        <TextField
          label={t('profile.weightKg')}
          value={values.weightKg}
          onChangeText={(weightKg) => onChange('weightKg', weightKg)}
          placeholder={t('profile.weightPlaceholder')}
          keyboardType="decimal-pad"
          error={errors.weightKg}
          style={{ flex: 1 }}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color={errors.bloodType ? 'dangerText' : 'textSecondary'}>
          {t('profile.bloodType')}
        </AppText>
        <ChoiceChips
          options={bloodTypeOptions}
          value={values.bloodType || null}
          onChange={(bloodType) => onChange('bloodType', bloodType ?? '')}
          accessibilityLabel={t('profile.bloodType')}
        />
      </View>

      <AppText variant="caption" color="textMuted">
        {possessive === 'your' ? t('profile.noteYour') : t('profile.noteTheir')}
      </AppText>
    </View>
  );
}
