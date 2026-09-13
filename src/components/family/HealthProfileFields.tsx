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
  bloodTypeLabel,
  GENDER_LABELS,
  GENDERS,
  type BloodType,
  type Gender,
  type HealthProfileFormValues,
} from '@/domain/familyMember';
import { useTheme } from '@/theme/ThemeContext';

type Field = keyof HealthProfileFormValues;

const GENDER_OPTIONS: readonly ChipOption<Gender>[] = GENDERS.map((gender) => ({
  value: gender,
  label: GENDER_LABELS[gender],
}));

const BLOOD_TYPE_OPTIONS: readonly ChipOption<BloodType>[] = BLOOD_TYPES.map((bloodType) => ({
  value: bloodType,
  label: bloodTypeLabel(bloodType),
}));

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
  const onChange = <K extends Field>(field: K, value: HealthProfileFormValues[K]) =>
    emit({ [field]: value } as Partial<HealthProfileFormValues>);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <DateField
        label="Date of birth"
        value={values.dateOfBirth}
        onChange={(dateOfBirth) => onChange('dateOfBirth', dateOfBirth)}
        error={errors.dateOfBirth}
        helper={`Used to show ${possessive} age. Optional.`}
        maximumDate={new Date()}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color={errors.gender ? 'dangerText' : 'textSecondary'}>
          Gender
        </AppText>
        <ChoiceChips
          options={GENDER_OPTIONS}
          value={values.gender || null}
          onChange={(gender) => onChange('gender', gender ?? '')}
          accessibilityLabel="Gender"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <TextField
          label="Height (cm)"
          value={values.heightCm}
          onChangeText={(heightCm) => onChange('heightCm', heightCm)}
          placeholder="e.g. 170"
          keyboardType="decimal-pad"
          error={errors.heightCm}
          style={{ flex: 1 }}
        />
        <TextField
          label="Weight (kg)"
          value={values.weightKg}
          onChangeText={(weightKg) => onChange('weightKg', weightKg)}
          placeholder="e.g. 70"
          keyboardType="decimal-pad"
          error={errors.weightKg}
          style={{ flex: 1 }}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color={errors.bloodType ? 'dangerText' : 'textSecondary'}>
          Blood type
        </AppText>
        <ChoiceChips
          options={BLOOD_TYPE_OPTIONS}
          value={values.bloodType || null}
          onChange={(bloodType) => onChange('bloodType', bloodType ?? '')}
          accessibilityLabel="Blood type"
        />
      </View>

      <AppText variant="caption" color="textMuted">
        These details are saved on this device under {possessive === 'your' ? 'your' : 'their'}{' '}
        profile. The assistant may mention that one of them could be relevant to a medicine, but
        MediMind never works out a dose from them or decides whether a medicine is suitable — a
        pharmacist or doctor does that.
      </AppText>
    </View>
  );
}
