/**
 * The medicine form, shared by "Add manually" and "Edit".
 *
 * One component for both is what guarantees the two screens can never drift
 * apart in their validation rules or their field order.
 *
 * Validation runs on submit rather than on every keystroke: telling someone
 * their half-typed date is invalid while they are still typing it is hostile,
 * particularly for the older users this app targets.
 */

import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, InlineMessage, TextField } from '@/components/ui';
import {
  medicationInputSchema,
  type MedicationFormValues,
  type MedicationInput,
} from '@/domain/medication';
import type { AppError } from '@/lib/errors';
import { fieldErrorsOf } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeContext';

type FormField = keyof MedicationFormValues;

export type MedicationFormProps = {
  initialValues: MedicationFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  /** Receives already-validated, normalised values. */
  onSubmit: (input: MedicationInput) => void;
  onCancel: () => void;
  /** Error from the save attempt, e.g. a database failure. */
  error?: AppError | null;
};

export function MedicationForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  error,
}: MedicationFormProps) {
  const theme = useTheme();

  const [values, setValues] = useState<MedicationFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});

  const setField = (field: FormField) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    // Clear this field's error as soon as the user starts fixing it.
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    const parsed = medicationInputSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(fieldErrorsOf<FormField>(parsed.error));
      return;
    }

    setFieldErrors({});
    onSubmit(parsed.data);
  };

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {error ? <InlineMessage tone="danger" message={error.message} /> : null}

      {hasErrors ? (
        <InlineMessage
          tone="warning"
          message="Please check the highlighted fields below and try again."
        />
      ) : null}

      <TextField
        label="Medicine name"
        value={values.name}
        onChangeText={setField('name')}
        placeholder="e.g. Paracetamol"
        error={fieldErrors.name}
        autoCapitalize="sentences"
        helper="Required. Copy it exactly as printed on the box."
      />

      <TextField
        label="Dosage"
        value={values.dosage}
        onChangeText={setField('dosage')}
        placeholder="e.g. 500 mg"
        error={fieldErrors.dosage}
        autoCapitalize="none"
        helper="Leave blank if you cannot read it — MediMind will not guess."
      />

      <TextField
        label="How often"
        value={values.frequency}
        onChangeText={setField('frequency')}
        placeholder="e.g. Twice daily"
        error={fieldErrors.frequency}
        autoCapitalize="sentences"
      />

      <TextField
        label="Expiry date"
        value={values.expirationDate}
        onChangeText={setField('expirationDate')}
        placeholder="YYYY-MM-DD"
        error={fieldErrors.expirationDate}
        keyboardType="numbers-and-punctuation"
        helper="Year first, for example 2027-04-30. Leave blank if there is none."
      />

      <TextField
        label="Instructions"
        value={values.instructions}
        onChangeText={setField('instructions')}
        placeholder="e.g. Take with food"
        error={fieldErrors.instructions}
        autoCapitalize="sentences"
        multiline
      />

      <TextField
        label="Notes"
        value={values.notes}
        onChangeText={setField('notes')}
        placeholder="Anything you want to remember"
        error={fieldErrors.notes}
        autoCapitalize="sentences"
        multiline
      />

      <AppText variant="caption" color="textMuted">
        MediMind stores exactly what you enter here. It does not check whether a
        medicine is suitable for you — always follow the label and ask a pharmacist
        if you are unsure.
      </AppText>

      <View style={{ gap: theme.spacing.md }}>
        <Button
          label={submitLabel}
          onPress={handleSubmit}
          loading={isSubmitting}
          size="large"
          icon="checkmark"
        />
        <Button label="Cancel" onPress={onCancel} variant="secondary" disabled={isSubmitting} />
      </View>
    </View>
  );
}
