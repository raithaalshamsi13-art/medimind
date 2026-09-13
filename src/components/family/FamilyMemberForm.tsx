/**
 * Add / edit a family member. Shared by both screens so the rules cannot
 * diverge. Deliberately short: name, relationship, optional date of birth,
 * avatar colour. Nothing else is needed to keep someone's medicines apart.
 */

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  ChoiceChips,
  DateField,
  InlineMessage,
  TextField,
  type ChipOption,
} from '@/components/ui';
import {
  ADDABLE_RELATIONSHIPS,
  AVATAR_COLOR_LABELS,
  AVATAR_COLORS,
  familyMemberInputSchema,
  RELATIONSHIP_LABELS,
  type AvatarColor,
  type FamilyMemberFormValues,
  type FamilyMemberInput,
  type Relationship,
} from '@/domain/familyMember';
import type { AppError } from '@/lib/errors';
import { fieldErrorsOf } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeContext';

import { MemberAvatar } from './MemberAvatar';

type Field = keyof FamilyMemberFormValues;

const RELATIONSHIP_OPTIONS: readonly ChipOption<Relationship>[] = ADDABLE_RELATIONSHIPS.map(
  (relationship) => ({ value: relationship, label: RELATIONSHIP_LABELS[relationship] }),
);

export type FamilyMemberFormProps = {
  initialValues: FamilyMemberFormValues;
  /** The account holder's own profile: relationship is fixed to "Me". */
  isSelf: boolean;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (input: FamilyMemberInput) => void;
  onCancel: () => void;
  error?: AppError | null;
};

export function FamilyMemberForm({
  initialValues,
  isSelf,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  error,
}: FamilyMemberFormProps) {
  const theme = useTheme();
  const [values, setValues] = useState<FamilyMemberFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const setField = <K extends Field>(field: K, value: FamilyMemberFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    const parsed = familyMemberInputSchema.safeParse({
      ...values,
      relationship: isSelf ? 'ME' : values.relationship,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsOf<Field>(parsed.error));
      return;
    }
    setFieldErrors({});
    onSubmit(parsed.data);
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {error ? <InlineMessage tone="danger" message={error.message} /> : null}

      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <MemberAvatar member={{ name: values.name || '?', avatarColor: values.avatarColor }} size={72} />
        <AppText variant="caption" color="textMuted">
          Preview
        </AppText>
      </View>

      <TextField
        label="Name"
        value={values.name}
        onChangeText={(name) => setField('name', name)}
        placeholder={isSelf ? 'Your name' : 'e.g. Fatima'}
        error={fieldErrors.name}
        autoCapitalize="words"
        helper="Shown on their profile and on every medicine screen."
      />

      {isSelf ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            Relationship
          </AppText>
          <AppText variant="body">Me — this is your own profile.</AppText>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" color={fieldErrors.relationship ? 'dangerText' : 'textSecondary'}>
            Relationship to you
          </AppText>
          <ChoiceChips
            options={RELATIONSHIP_OPTIONS}
            value={values.relationship || null}
            onChange={(relationship) => setField('relationship', relationship ?? '')}
            accessibilityLabel="Relationship"
            allowClear={false}
          />
          {fieldErrors.relationship ? (
            <AppText variant="caption" color="dangerText">
              {fieldErrors.relationship}
            </AppText>
          ) : null}
        </View>
      )}

      {values.relationship === 'OTHER' && !isSelf ? (
        <TextField
          label="How are they related to you?"
          value={values.customRelationship}
          onChangeText={(customRelationship) => setField('customRelationship', customRelationship)}
          placeholder="e.g. Aunt, Neighbour, Friend"
          error={fieldErrors.customRelationship}
          autoCapitalize="sentences"
        />
      ) : null}

      <DateField
        label="Date of birth (optional)"
        value={values.dateOfBirth}
        onChange={(dateOfBirth) => setField('dateOfBirth', dateOfBirth)}
        error={fieldErrors.dateOfBirth}
        helper="Only used to show their age on the profile."
        maximumDate={new Date()}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color="textSecondary">
          Avatar colour
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {AVATAR_COLORS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              name={values.name || '?'}
              selected={values.avatarColor === color}
              onPress={() => setField('avatarColor', color)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Button label={submitLabel} onPress={handleSubmit} loading={isSubmitting} icon="checkmark" size="large" />
        <Button label="Cancel" onPress={onCancel} variant="secondary" disabled={isSubmitting} />
      </View>
    </View>
  );
}

function ColorSwatch({
  color,
  name,
  selected,
  onPress,
}: {
  color: AvatarColor;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={AVATAR_COLOR_LABELS[color]}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: theme.spacing.xs,
        padding: theme.spacing.xs,
        borderRadius: theme.radius.md,
        borderWidth: 2,
        borderColor: selected ? theme.colors.primary : 'transparent',
        backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
        minWidth: theme.touch.comfortable,
      })}>
      <MemberAvatar member={{ name, avatarColor: color }} size={44} />
      <AppText variant="caption" color={selected ? 'primary' : 'textSecondary'} weight={selected ? '700' : '500'}>
        {AVATAR_COLOR_LABELS[color]}
      </AppText>
    </Pressable>
  );
}
