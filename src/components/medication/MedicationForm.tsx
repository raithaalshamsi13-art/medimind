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
  conditionDisplayName,
  EMPTY_CONDITION_FORM,
  type HealthCondition,
  type HealthConditionInput,
} from '@/domain/healthCondition';
import {
  MEDICATION_KIND_LABELS,
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
  dosageUnitLabel,
  FREQUENCY_PRESET_LABELS,
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
import type { AppError } from '@/lib/errors';
import { fieldErrorsOf } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeContext';

import { MEDICATION_FORM_OPTIONS } from './formIcons';

type FormField = keyof MedicationFormValues;

// ---------------------------------------------------------------------------
// Static option lists
// ---------------------------------------------------------------------------

const KIND_OPTIONS: readonly ChipOption<MedicationKind>[] = MEDICATION_KINDS.map((kind) => ({
  value: kind,
  label: MEDICATION_KIND_LABELS[kind],
}));

const UNIT_OPTIONS: readonly ChipOption<DosageUnit>[] = DOSAGE_UNITS.map((unit) => ({
  value: unit,
  label: dosageUnitLabel(unit),
}));

const FREQUENCY_OPTIONS: readonly ChipOption<FrequencyPreset>[] = FREQUENCY_PRESETS.map(
  (preset) => ({ value: preset, label: FREQUENCY_PRESET_LABELS[preset] }),
);

const INSTRUCTION_CHIPS: readonly ChipOption<InstructionOption>[] = INSTRUCTION_OPTIONS.map(
  (option) => ({ value: option, label: option }),
);

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

/** Draft → the plain values the schema validates, plus errors only the draft can detect. */
function compose(draft: Draft): Composed {
  const errors: Partial<Record<FormField, string>> = {};

  let dosage = '';
  if (draft.doseMode === 'custom') {
    dosage = draft.doseCustom;
  } else if (draft.doseAmount.trim().length > 0) {
    if (!isValidDoseAmount(draft.doseAmount)) {
      errors.dosage = 'Please enter the amount as a number, for example 500 or 2.5.';
    } else if (!draft.doseUnit) {
      errors.dosage = 'Please choose a unit for the amount, for example mg or tablet(s).';
    } else {
      dosage = composeDosage(draft.doseAmount, draft.doseUnit) ?? '';
    }
  }

  let frequency = composeFrequency(draft.frequency) ?? '';
  if (draft.frequency.preset === 'EVERY_HOURS' && !isValidEveryHours(draft.frequency.hours)) {
    errors.frequency = 'Please enter how many hours, from 1 to 24.';
    frequency = '';
  } else if (draft.frequency.preset === 'OTHER' && frequency.length === 0) {
    errors.frequency = 'Please type how often, or choose one of the options above.';
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
    const composed = compose(draft);
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
      ? `${conditionDisplayName(condition)} · ${condition.reading}`
      : conditionDisplayName(condition),
  }));

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {error ? <InlineMessage tone="danger" message={error.message} /> : null}

      {hasErrors ? (
        <InlineMessage
          tone="warning"
          message="Please check the highlighted fields below and try again."
        />
      ) : null}

      {/* ---------- 1. About the medicine ---------- */}
      <FormSection
        step={1}
        title="About the medicine"
        description="Only the name is required. Choose the rest if you know it.">
        <TextField
          label="Medicine name"
          value={draft.name}
          onChangeText={(name) => patch({ name }, ['name'])}
          placeholder="e.g. Paracetamol"
          error={fieldErrors.name}
          autoCapitalize="sentences"
          helper="Required. Copy it exactly as printed on the box."
        />

        <FieldGroup label="Type" error={fieldErrors.kind}>
          <ChoiceChips
            options={KIND_OPTIONS}
            value={draft.kind}
            onChange={(kind) => patch({ kind }, ['kind'])}
            accessibilityLabel="Medicine type"
          />
        </FieldGroup>

        <FieldGroup label="Form" error={fieldErrors.form}>
          <ChoiceChips
            options={MEDICATION_FORM_OPTIONS}
            value={draft.form}
            onChange={(form) => patch({ form }, ['form'])}
            accessibilityLabel="Medicine form"
          />
        </FieldGroup>
      </FormSection>

      {/* ---------- 2. Dose and how often ---------- */}
      <FormSection
        step={2}
        title="Dose and how often"
        description="Copy these from the label. Leave blank if you cannot read them — MediMind will not guess.">
        {draft.doseMode === 'structured' ? (
          <View style={{ gap: theme.spacing.md }}>
            <TextField
              label="Amount"
              value={draft.doseAmount}
              onChangeText={(doseAmount) => patch({ doseAmount }, ['dosage'])}
              placeholder="e.g. 500"
              keyboardType="decimal-pad"
              error={fieldErrors.dosage}
            />
            <FieldGroup label="Unit">
              <ChoiceChips
                options={UNIT_OPTIONS}
                value={draft.doseUnit}
                onChange={(doseUnit) => patch({ doseUnit }, ['dosage'])}
                accessibilityLabel="Dose unit"
              />
            </FieldGroup>
            <TextLink
              label="Type the dose as text instead"
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
              label="Dosage"
              value={draft.doseCustom}
              onChangeText={(doseCustom) => patch({ doseCustom }, ['dosage'])}
              placeholder="e.g. 1 sachet in water"
              error={fieldErrors.dosage}
              autoCapitalize="none"
            />
            <TextLink
              label="Choose an amount and unit instead"
              onPress={() => patch({ doseMode: 'structured' }, ['dosage'])}
            />
          </View>
        )}

        <FieldGroup label="How often" error={fieldErrors.frequency}>
          <ChoiceChips
            options={FREQUENCY_OPTIONS}
            value={draft.frequency.preset}
            onChange={(preset) => patch({ frequency: { ...draft.frequency, preset } }, ['frequency'])}
            accessibilityLabel="How often"
          />
          {draft.frequency.preset === 'EVERY_HOURS' ? (
            <TextField
              label="Every how many hours?"
              value={draft.frequency.hours}
              onChangeText={(hours) => patch({ frequency: { ...draft.frequency, hours } }, ['frequency'])}
              placeholder="e.g. 8"
              keyboardType="number-pad"
            />
          ) : null}
          {draft.frequency.preset === 'OTHER' ? (
            <TextField
              label="Describe how often"
              value={draft.frequency.custom}
              onChangeText={(custom) =>
                patch({ frequency: { ...draft.frequency, custom } }, ['frequency'])
              }
              placeholder="e.g. Every Monday morning"
              autoCapitalize="sentences"
            />
          ) : null}
        </FieldGroup>
      </FormSection>

      {/* ---------- 3. Expiry date ---------- */}
      <FormSection step={3} title="Expiry date" description="Printed on the box, usually as EXP.">
        <DateField
          label="Expiry date"
          value={draft.expirationDate}
          onChange={(expirationDate) => patch({ expirationDate }, ['expirationDate'])}
          error={fieldErrors.expirationDate}
          helper="Leave blank if the label has no readable date."
          maximumDate={new Date(2100, 11, 31)}
        />

        {expiry ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Badge
              label={expiry.label}
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
                title="This medicine has expired"
                message="You can still save it for your records, but MediMind will mark it as expired and will not create a normal reminder for it. Ask a pharmacist how to dispose of it."
              />
            ) : expiry.state === 'EXPIRING_SOON' ? (
              <InlineMessage
                tone="warning"
                message="This medicine expires within 30 days. Check with your pharmacist about a replacement."
              />
            ) : null}
          </View>
        ) : null}
      </FormSection>

      {/* ---------- 4. Instructions ---------- */}
      <FormSection
        step={4}
        title="Instructions"
        description="Tick anything the label says. Add your own wording for anything else.">
        <MultiChoiceChips
          options={INSTRUCTION_CHIPS}
          values={draft.instructionOptions}
          onChange={(instructionOptions) => patch({ instructionOptions }, ['instructions'])}
          accessibilityLabel="Common instructions"
        />

        <Collapsible
          title="Other instructions"
          icon="document-text-outline"
          summary={draft.instructionExtra || undefined}
          defaultOpen={draft.instructionExtra.length > 0}>
          <TextField
            label="Other instructions"
            value={draft.instructionExtra}
            onChangeText={(instructionExtra) => patch({ instructionExtra }, ['instructions'])}
            placeholder="e.g. Avoid grapefruit juice"
            error={fieldErrors.instructions}
            autoCapitalize="sentences"
            multiline
          />
        </Collapsible>
        {fieldErrors.instructions && draft.instructionExtra.length === 0 ? (
          <AppText variant="caption" color="dangerText">
            {fieldErrors.instructions}
          </AppText>
        ) : null}
      </FormSection>

      {/* ---------- 5. Health conditions ---------- */}
      <FormSection
        step={5}
        title="Health conditions"
        description="Optional. Tick the conditions this medicine relates to, for your own organisation.">
        {conditions.length > 0 ? (
          <MultiChoiceChips
            options={conditionOptions}
            values={draft.conditionIds}
            onChange={(conditionIds) => patch({ conditionIds }, ['conditionIds'])}
            accessibilityLabel="Related health conditions"
          />
        ) : (
          <AppText variant="body" color="textSecondary">
            You have not added any health conditions yet.
          </AppText>
        )}
        {fieldErrors.conditionIds ? (
          <AppText variant="caption" color="dangerText">
            {fieldErrors.conditionIds}
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
            <AppText variant="subheading">New condition</AppText>
            <HealthConditionEditor
              initialValues={EMPTY_CONDITION_FORM}
              submitLabel="Save condition"
              isSubmitting={isSavingCondition}
              onSubmit={(input) => void handleCreateCondition(input)}
              onCancel={() => setIsAddingCondition(false)}
              error={conditionError}
            />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label="Add a condition"
              icon="add-circle-outline"
              variant="secondary"
              onPress={() => setIsAddingCondition(true)}
            />
            {conditions.length > 0 ? (
              <TextLink
                label="Edit or remove my conditions"
                onPress={onManageConditions}
                accessibilityHint="Opens the My Health Conditions screen"
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
            Conditions are notes for you. MediMind never uses them to judge or suggest a medicine,
            and they are not shared with the assistant.
          </AppText>
        </View>
      </FormSection>

      {/* ---------- Notes ---------- */}
      <Collapsible
        title="Notes"
        icon="create-outline"
        summary={draft.notes || undefined}
        defaultOpen={draft.notes.length > 0}>
        <TextField
          label="Notes"
          value={draft.notes}
          onChangeText={(notes) => patch({ notes }, ['notes'])}
          placeholder="Anything you want to remember"
          error={fieldErrors.notes}
          autoCapitalize="sentences"
          multiline
        />
      </Collapsible>

      <AppText variant="caption" color="textMuted">
        MediMind stores exactly what you enter here. It does not check whether a medicine is
        suitable for you — always follow the label and ask a pharmacist if you are unsure.
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
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
