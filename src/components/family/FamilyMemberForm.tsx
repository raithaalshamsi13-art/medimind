/**
 * Add / edit a family member (including the account holder's own "Me"
 * profile). Shared by both screens so the rules cannot diverge.
 *
 * Name, relationship and avatar colour identify the person; the health
 * profile fields (date of birth, gender, height, weight, blood type) are
 * optional context — see HealthProfileFields.
 */

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, ChoiceChips, InlineMessage, TextField, type ChipOption } from '@/components/ui';
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

import { HealthProfileFields } from './HealthProfileFields';
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
    <View style={{ gap: theme.spacing.xl }}>
      {error ? <InlineMessage tone="danger" message={error.message} /> : null}

      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <MemberAvatar member={{ name: values.name || '?', avatarColor: values.avatarColor }} size={72} />
        <AppText variant="caption" color="textMuted">
          Preview
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <AppText variant="heading">{isSelf ? 'About you' : 'Who they are'}</AppText>

        <TextField
          label="Name"
          value={values.name}
          onChangeText={(name) => setField('name', name)}
          placeholder={isSelf ? 'Your name' : 'e.g. Fatima'}
          error={fieldErrors.name}
          autoCapitalize="words"
          helper="Shown on the profile and on every medicine screen."
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
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <AppText variant="heading">Health profile</AppText>
          <AppText variant="caption" color="textSecondary">
            All optional. Fill in what you know.
          </AppText>
        </View>
        <HealthProfileFields
          values={values}
          errors={fieldErrors}
          onChange={(patch) => {
            for (const [field, value] of Object.entries(patch) as [Field, FamilyMemberFormValues[Field]][]) {
              setField(field, value);
            }
          }}
          possessive={isSelf ? 'your' : 'their'}
        />
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
