/**
 * The medicine form, shared by "Add manually" and "Edit".
 *
 * One component for both is what guarantees the two screens can never drift
 * apart in their validation rules or their field order.
 *
 * HOW IT IS BUILT
 * The form keeps a richer *draft* than what is stored: an amount plus a unit,
 * a frequency chip, a set of instruction chips. On submit the draft is
 * composed into the plain-text fields the rest of the app understands (see
 * domain/medicationOptions.ts) and then run through the same Zod schema as
 * before. Anything that cannot be expressed with chips falls back to typing,
 * so the structured controls never get in the way of copying a label.
 *
 * Validation runs on submit rather than on every keystroke: telling someone
 * their half-typed value is invalid while they are still typing it is
 * hostile, particularly for the older users this app targets. The one
 * exception is the expiry date, whose "expired / expiring soon" status is
 * shown live because it is information, not a scolding.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { HealthConditionEditor } from '@/components/health/HealthConditionEditor';
import {
  AppText,
  Badge,
  Button,
  ChoiceChips,
  Collapsible,
  DateField,
  FormSection,
  InlineMessage,
  MultiChoiceChips,
  TextField,
  TextLink,
  type BadgeTone,
  type ChipOption,
} from '@/components/ui';
import { expiryStatus, type ExpiryState } from '@/domain/expiry';
import {
  EMPTY_CONDITION_FORM,
  type HealthCondition,
  type HealthConditionInput,
} from '@/domain/healthCondition';
import {
  MEDICATION_FORMS,
  MEDICATION_KINDS,
  medicationInputSchema,
  type MedicationForm as MedicationFormKind,
  type MedicationFormValues,
  type MedicationInput,
  type MedicationKind,
} from '@/domain/medication';
import {
  composeDosage,
  composeFrequency,
  composeInstructions,
  DOSAGE_UNITS,
  FREQUENCY_PRESETS,
  INSTRUCTION_OPTIONS,
  isValidDoseAmount,
  isValidEveryHours,
  parseDosage,
  parseFrequencyChoice,
  parseInstructions,
  type DosageUnit,
  type FrequencyChoice,
  type FrequencyPreset,
  type InstructionOption,
} from '@/domain/medicationOptions';
import { useT } from '@/i18n';
import {
  conditionNameT,
  expiryLabelT,
  frequencyPresetLabel,
  instructionLabel,
  kindLabel,
  localizeMessage,
  medicationFormLabel,
  unitLabel,
} from '@/i18n/labels';
import type { AppError } from '@/lib/errors';
import { fieldErrorsOf } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeContext';

import { MEDICATION_FORM_ICONS } from './formIcons';

type FormField = keyof MedicationFormValues;

// ---------------------------------------------------------------------------
// Static option lists
// ---------------------------------------------------------------------------


const EXPIRY_TONES: Record<ExpiryState, BadgeTone> = {
  EXPIRED: 'danger',
  EXPIRING_SOON: 'warning',
  OK: 'success',
};

// ---------------------------------------------------------------------------
// Draft state
// ---------------------------------------------------------------------------

type Draft = {
  name: string;
  kind: MedicationKind | null;
  form: MedicationFormKind | null;
  /** "structured" = amount + unit chips; "custom" = typed as one text. */
  doseMode: 'structured' | 'custom';
  doseAmount: string;
  doseUnit: DosageUnit | null;
  doseCustom: string;
  frequency: FrequencyChoice;
  expirationDate: string;
  instructionOptions: InstructionOption[];
  instructionExtra: string;
  notes: string;
  conditionIds: string[];
};

/** Turn stored/initial values into the draft, keeping any text that does not fit a chip. */
function toDraft(values: MedicationFormValues): Draft {
  const dosage = parseDosage(values.dosage);
  const instructions = parseInstructions(values.instructions);
  return {
    name: values.name,
    kind: values.kind || null,
    form: values.form || null,
    doseMode: values.dosage.trim().length > 0 && !dosage ? 'custom' : 'structured',
    doseAmount: dosage?.amount ?? '',
    doseUnit: dosage?.unit ?? null,
    doseCustom: dosage ? '' : values.dosage,
    frequency: parseFrequencyChoice(values.frequency),
    expirationDate: values.expirationDate,
    instructionOptions: instructions.selected,
    instructionExtra: instructions.extra,
    notes: values.notes,
    conditionIds: values.conditionIds,
  };
}

type Composed = { values: MedicationFormValues; errors: Partial<Record<FormField, string>> };
type Translate = ReturnType<typeof useT>['t'];

/** Draft → the plain values the schema validates, plus errors only the draft can detect. */
function compose(draft: Draft, t: Translate): Composed {
  const errors: Partial<Record<FormField, string>> = {};

  let dosage = '';
  if (draft.doseMode === 'custom') {
    dosage = draft.doseCustom;
  } else if (draft.doseAmount.trim().length > 0) {
    if (!isValidDoseAmount(draft.doseAmount)) {
      errors.dosage = t('form.errAmountNumber');
    } else if (!draft.doseUnit) {
      errors.dosage = t('form.errUnit');
    } else {
      dosage = composeDosage(draft.doseAmount, draft.doseUnit) ?? '';
    }
  }

  let frequency = composeFrequency(draft.frequency) ?? '';
  if (draft.frequency.preset === 'EVERY_HOURS' && !isValidEveryHours(draft.frequency.hours)) {
    errors.frequency = t('form.errHours');
    frequency = '';
  } else if (draft.frequency.preset === 'OTHER' && frequency.length === 0) {
    errors.frequency = t('form.errDescribe');
  }

  return {
    values: {
      name: draft.name,
      kind: draft.kind ?? '',
      form: draft.form ?? '',
      dosage,
      frequency,
      expirationDate: draft.expirationDate,
      instructions: composeInstructions(draft.instructionOptions, draft.instructionExtra) ?? '',
      notes: draft.notes,
      conditionIds: draft.conditionIds,
    },
    errors,
  };
}

// ---------------------------------------------------------------------------

export type MedicationFormProps = {
  initialValues: MedicationFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  /** Receives already-validated, normalised values. */
  onSubmit: (input: MedicationInput) => void;
  onCancel: () => void;
  /** Error from the save attempt, e.g. a database failure. */
  error?: AppError | null;
  /** The user's saved conditions, offered as chips to link. */
  conditions: HealthCondition[];
  /** Saves a new condition and returns it (or null on failure). */
  onCreateCondition: (input: HealthConditionInput) => Promise<HealthCondition | null>;
  isSavingCondition: boolean;
  conditionError?: AppError | null;
  /** Opens the My Health Conditions screen. */
  onManageConditions: () => void;
};

export function MedicationForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  error,
  conditions,
  onCreateCondition,
  isSavingCondition,
  conditionError,
  onManageConditions,
}: MedicationFormProps) {
  const theme = useTheme();
  const { t } = useT();

  const kindOptions: readonly ChipOption<MedicationKind>[] = MEDICATION_KINDS.map((kind) => ({
    value: kind,
    label: kindLabel(t, kind),
  }));
  const formOptions: readonly ChipOption<MedicationFormKind>[] = MEDICATION_FORMS.map((form) => ({
    value: form,
    label: medicationFormLabel(t, form),
    icon: MEDICATION_FORM_ICONS[form],
  }));
  const unitOptions: readonly ChipOption<DosageUnit>[] = DOSAGE_UNITS.map((unit) => ({
    value: unit,
    label: unitLabel(t, unit),
  }));
  const frequencyOptions: readonly ChipOption<FrequencyPreset>[] = FREQUENCY_PRESETS.map((preset) => ({
    value: preset,
    label: frequencyPresetLabel(t, preset),
  }));
  const instructionChips: readonly ChipOption<InstructionOption>[] = INSTRUCTION_OPTIONS.map((option) => ({
    value: option,
    label: instructionLabel(t, option),
  }));

  const [draft, setDraft] = useState<Draft>(() => toDraft(initialValues));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [isAddingCondition, setIsAddingCondition] = useState(false);

  /** Update part of the draft and clear the matching field's error. */
  const patch = (changes: Partial<Draft>, clears: FormField[] = []) => {
    setDraft((current) => ({ ...current, ...changes }));
    if (clears.length === 0) return;
    setFieldErrors((current) => {
      if (!clears.some((field) => current[field])) return current;
      const next = { ...current };
      for (const field of clears) delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    const composed = compose(draft, t);
    const parsed = medicationInputSchema.safeParse(composed.values);

    const errors: Partial<Record<FormField, string>> = {
      ...(parsed.success ? {} : fieldErrorsOf<FormField>(parsed.error)),
      ...composed.errors,
    };
    if (!parsed.success || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    onSubmit(parsed.data);
  };

  const handleCreateCondition = async (input: HealthConditionInput) => {
    const created = await onCreateCondition(input);
    if (created) {
      // Link the new condition straight away — that is why they added it here.
      patch({ conditionIds: [...draft.conditionIds, created.id] });
      setIsAddingCondition(false);
    }
  };

  const hasErrors = Object.keys(fieldErrors).length > 0;
  const expiry = expiryStatus(draft.expirationDate);

  const conditionOptions: ChipOption<string>[] = conditions.map((condition) => ({
    value: condition.id,
    label: condition.reading
      ? `${conditionNameT(t, condition)} · ${condition.reading}`
      : conditionNameT(t, condition),
  }));

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {error ? <InlineMessage tone="danger" message={error.message} /> : null}

      {hasErrors ? (
        <InlineMessage
          tone="warning"
          message={t('common.checkFields')}
        />
      ) : null}

      {/* ---------- 1. About the medicine ---------- */}
      <FormSection
        step={1}
        title={t('form.section1Title')}
        description={t('form.section1Desc')}>
        <TextField
          label={t('form.name')}
          value={draft.name}
          onChangeText={(name) => patch({ name }, ['name'])}
          placeholder={t('form.namePlaceholder')}
          error={fieldErrors.name}
          autoCapitalize="sentences"
          helper={t('form.nameHelper')}
        />

        <FieldGroup label={t('form.type')} error={fieldErrors.kind}>
          <ChoiceChips
            options={kindOptions}
            value={draft.kind}
            onChange={(kind) => patch({ kind }, ['kind'])}
            accessibilityLabel={t('form.type')}
          />
        </FieldGroup>

        <FieldGroup label={t('form.form')} error={fieldErrors.form}>
          <ChoiceChips
            options={formOptions}
            value={draft.form}
            onChange={(form) => patch({ form }, ['form'])}
            accessibilityLabel={t('form.form')}
          />
        </FieldGroup>
      </FormSection>

      {/* ---------- 2. Dose and how often ---------- */}
      <FormSection
        step={2}
        title={t('form.section2Title')}
        description={t('form.section2Desc')}>
        {draft.doseMode === 'structured' ? (
          <View style={{ gap: theme.spacing.md }}>
            <TextField
              label={t('form.amount')}
              value={draft.doseAmount}
              onChangeText={(doseAmount) => patch({ doseAmount }, ['dosage'])}
              placeholder={t('form.amountPlaceholder')}
              keyboardType="decimal-pad"
              error={fieldErrors.dosage}
            />
            <FieldGroup label={t('form.unit')}>
              <ChoiceChips
                options={unitOptions}
                value={draft.doseUnit}
                onChange={(doseUnit) => patch({ doseUnit }, ['dosage'])}
                accessibilityLabel={t('form.unit')}
              />
            </FieldGroup>
            <TextLink
              label={t('form.typeDoseAsText')}
              onPress={() =>
                patch(
                  {
                    doseMode: 'custom',
                    doseCustom:
                      draft.doseUnit && draft.doseAmount
                        ? (composeDosage(draft.doseAmount, draft.doseUnit) ?? '')
                        : draft.doseAmount,
                  },
                  ['dosage'],
                )
              }
            />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <TextField
              label={t('form.dosage')}
              value={draft.doseCustom}
              onChangeText={(doseCustom) => patch({ doseCustom }, ['dosage'])}
              placeholder={t('form.dosagePlaceholder')}
              error={fieldErrors.dosage}
              autoCapitalize="none"
            />
            <TextLink
              label={t('form.chooseAmountUnit')}
              onPress={() => patch({ doseMode: 'structured' }, ['dosage'])}
            />
          </View>
        )}

        <FieldGroup label={t('form.howOften')} error={fieldErrors.frequency}>
          <ChoiceChips
            options={frequencyOptions}
            value={draft.frequency.preset}
            onChange={(preset) => patch({ frequency: { ...draft.frequency, preset } }, ['frequency'])}
            accessibilityLabel={t('form.howOften')}
          />
          {draft.frequency.preset === 'EVERY_HOURS' ? (
            <TextField
              label={t('form.everyHowManyHours')}
              value={draft.frequency.hours}
              onChangeText={(hours) => patch({ frequency: { ...draft.frequency, hours } }, ['frequency'])}
              placeholder={t('form.hoursPlaceholder')}
              keyboardType="number-pad"
            />
          ) : null}
          {draft.frequency.preset === 'OTHER' ? (
            <TextField
              label={t('form.describeHowOften')}
              value={draft.frequency.custom}
              onChangeText={(custom) =>
                patch({ frequency: { ...draft.frequency, custom } }, ['frequency'])
              }
              placeholder={t('form.howOftenPlaceholder')}
              autoCapitalize="sentences"
            />
          ) : null}
        </FieldGroup>
      </FormSection>

      {/* ---------- 3. Expiry date ---------- */}
      <FormSection step={3} title={t('form.section3Title')} description={t('form.section3Desc')}>
        <DateField
          label={t('form.expiryDate')}
          value={draft.expirationDate}
          onChange={(expirationDate) => patch({ expirationDate }, ['expirationDate'])}
          error={fieldErrors.expirationDate}
          helper={t('form.expiryHelper')}
          maximumDate={new Date(2100, 11, 31)}
        />

        {expiry ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Badge
              label={expiryLabelT(t, expiry)}
              tone={EXPIRY_TONES[expiry.state]}
              icon={
                expiry.state === 'EXPIRED'
                  ? 'alert-circle'
                  : expiry.state === 'EXPIRING_SOON'
                    ? 'time-outline'
                    : 'checkmark-circle-outline'
              }
            />
            {expiry.state === 'EXPIRED' ? (
              <InlineMessage
                tone="danger"
                title={t('form.expiredTitle')}
                message={t('form.expiredBody')}
              />
            ) : expiry.state === 'EXPIRING_SOON' ? (
              <InlineMessage
                tone="warning"
                message={t('form.expiringSoonBody')}
              />
            ) : null}
          </View>
        ) : null}
      </FormSection>

      {/* ---------- 4. Instructions ---------- */}
      <FormSection
        step={4}
        title={t('form.section4Title')}
        description={t('form.section4Desc')}>
        <MultiChoiceChips
          options={instructionChips}
          values={draft.instructionOptions}
          onChange={(instructionOptions) => patch({ instructionOptions }, ['instructions'])}
          accessibilityLabel={t('form.section4Title')}
        />

        <Collapsible
          title={t('form.otherInstructions')}
          icon="document-text-outline"
          summary={draft.instructionExtra || undefined}
          defaultOpen={draft.instructionExtra.length > 0}>
          <TextField
            label={t('form.otherInstructions')}
            value={draft.instructionExtra}
            onChangeText={(instructionExtra) => patch({ instructionExtra }, ['instructions'])}
            placeholder={t('form.otherInstructionsPlaceholder')}
            error={fieldErrors.instructions}
            autoCapitalize="sentences"
            multiline
          />
        </Collapsible>
        {fieldErrors.instructions && draft.instructionExtra.length === 0 ? (
          <AppText variant="caption" color="dangerText">
            {localizeMessage(fieldErrors.instructions)}
          </AppText>
        ) : null}
      </FormSection>

      {/* ---------- 5. Health conditions ---------- */}
      <FormSection
        step={5}
        title={t('form.section5Title')}
        description={t('form.section5Desc')}>
        {conditions.length > 0 ? (
          <MultiChoiceChips
            options={conditionOptions}
            values={draft.conditionIds}
            onChange={(conditionIds) => patch({ conditionIds }, ['conditionIds'])}
            accessibilityLabel={t('form.section5Title')}
          />
        ) : (
          <AppText variant="body" color="textSecondary">
            {t('form.noConditionsYet')}
          </AppText>
        )}
        {fieldErrors.conditionIds ? (
          <AppText variant="caption" color="dangerText">
            {localizeMessage(fieldErrors.conditionIds)}
          </AppText>
        ) : null}

        {isAddingCondition ? (
          <View
            style={{
              gap: theme.spacing.md,
              padding: theme.spacing.base,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceAlt,
            }}>
            <AppText variant="subheading">{t('form.newCondition')}</AppText>
            <HealthConditionEditor
              initialValues={EMPTY_CONDITION_FORM}
              submitLabel={t('form.saveCondition')}
              isSubmitting={isSavingCondition}
              onSubmit={(input) => void handleCreateCondition(input)}
              onCancel={() => setIsAddingCondition(false)}
              error={conditionError}
            />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label={t('form.addCondition')}
              icon="add-circle-outline"
              variant="secondary"
              onPress={() => setIsAddingCondition(true)}
            />
            {conditions.length > 0 ? (
              <TextLink
                label={t('form.editRemoveConditions')}
                onPress={onManageConditions}
                accessibilityHint={t('form.editRemoveConditionsHint')}
              />
            ) : null}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.colors.textMuted}
            style={{ marginTop: 2 }}
          />
          <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
            {t('form.conditionsNote')}
          </AppText>
        </View>
      </FormSection>

      {/* ---------- Notes ---------- */}
      <Collapsible
        title={t('form.notes')}
        icon="create-outline"
        summary={draft.notes || undefined}
        defaultOpen={draft.notes.length > 0}>
        <TextField
          label={t('form.notes')}
          value={draft.notes}
          onChangeText={(notes) => patch({ notes }, ['notes'])}
          placeholder={t('form.notesPlaceholder')}
          error={fieldErrors.notes}
          autoCapitalize="sentences"
          multiline
        />
      </Collapsible>

      <AppText variant="caption" color="textMuted">
        {t('form.disclaimer')}
      </AppText>

      <View style={{ gap: theme.spacing.md }}>
        <Button
          label={submitLabel}
          onPress={handleSubmit}
          loading={isSubmitting}
          size="large"
          icon="checkmark"
        />
        <Button label={t('common.cancel')} onPress={onCancel} variant="secondary" disabled={isSubmitting} />
      </View>
    </View>
  );
}

/** A label above a chip row, with the same error treatment as TextField. */
function FieldGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" color={error ? 'dangerText' : 'textSecondary'}>
        {label}
      </AppText>
      {children}
      {error ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'flex-start' }}>
          <Ionicons
            name="alert-circle"
            size={16}
            color={theme.colors.danger}
            style={{ marginTop: 2 }}
          />
          <AppText variant="caption" color="dangerText" style={{ flex: 1 }}>
            {localizeMessage(error)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
