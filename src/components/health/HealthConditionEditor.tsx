/**
 * Add / edit one health condition.
 *
 * Used in two places — inline inside the medicine form ("Add a condition")
 * and on the My Health Conditions screen — so the two can never ask for
 * different things.
 *
 * Everything here is stored as typed. The reading field is plain text with a
 * *format* example as its placeholder ("e.g. 130/85"); MediMind never says
 * whether a reading is high, low or normal.
 */

import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  ChoiceChips,
  InlineMessage,
  TextField,
  type ChipOption,
} from '@/components/ui';
import {
  CONDITION_PRESETS,
  conditionPreset,
  healthConditionInputSchema,
  type ConditionType,
  type HealthConditionFormValues,
  type HealthConditionInput,
} from '@/domain/healthCondition';
import type { AppError } from '@/lib/errors';
import { fieldErrorsOf } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeContext';

type Field = keyof HealthConditionFormValues;

const TYPE_OPTIONS: readonly ChipOption<ConditionType>[] = CONDITION_PRESETS.map((preset) => ({
  value: preset.type,
  label: preset.label,
}));

export type HealthConditionEditorProps = {
  initialValues: HealthConditionFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (input: HealthConditionInput) => void;
  onCancel: () => void;
  error?: AppError | null;
};

export function HealthConditionEditor({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  error,
}: HealthConditionEditorProps) {
  const theme = useTheme();
  const [values, setValues] = useState<HealthConditionFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const setField = <K extends Field>(field: K, value: HealthConditionFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    const parsed = healthConditionInputSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsOf<Field>(parsed.error));
      return;
    }
    setFieldErrors({});
    onSubmit(parsed.data);
  };

  const preset = values.type ? conditionPreset(values.type) : null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {error ? <InlineMessage tone="danger" message={error.message} /> : null}

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color={fieldErrors.type ? 'dangerText' : 'textSecondary'}>
          Condition
        </AppText>
        <ChoiceChips
          options={TYPE_OPTIONS}
          value={values.type || null}
          onChange={(type) => setField('type', type ?? '')}
          accessibilityLabel="Condition"
          allowClear={false}
        />
        {fieldErrors.type ? (
          <AppText variant="caption" color="dangerText">
            {fieldErrors.type}
          </AppText>
        ) : null}
      </View>

      {values.type === 'OTHER' ? (
        <TextField
          label="Name of the condition"
          value={values.customName}
          onChangeText={(text) => setField('customName', text)}
          placeholder="e.g. Migraine"
          error={fieldErrors.customName}
          autoCapitalize="sentences"
        />
      ) : null}

      <TextField
        label="Latest reading (optional)"
        value={values.reading}
        onChangeText={(text) => setField('reading', text)}
        placeholder={preset?.readingHint ?? 'e.g. a value from your monitor'}
        error={fieldErrors.reading}
        helper="Write it exactly as your monitor or letter shows it. MediMind does not judge readings."
      />

      <TextField
        label="Notes (optional)"
        value={values.notes}
        onChangeText={(text) => setField('notes', text)}
        placeholder="e.g. Checked by the nurse every 3 months"
        error={fieldErrors.notes}
        autoCapitalize="sentences"
        multiline
      />

      <View style={{ gap: theme.spacing.md }}>
        <Button label={submitLabel} onPress={handleSubmit} loading={isSubmitting} icon="checkmark" />
        <Button label="Cancel" onPress={onCancel} variant="secondary" disabled={isSubmitting} />
      </View>
    </View>
  );
}
