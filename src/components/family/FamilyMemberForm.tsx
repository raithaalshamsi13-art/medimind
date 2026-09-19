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
  AVATAR_COLORS,
  familyMemberInputSchema,
  type AvatarColor,
  type FamilyMemberFormValues,
  type FamilyMemberInput,
  type Relationship,
} from '@/domain/familyMember';
import { useT } from '@/i18n';
import { avatarColorLabel, localizeMessage, relationshipLabelT } from '@/i18n/labels';
import type { AppError } from '@/lib/errors';
import { fieldErrorsOf } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeContext';

import { HealthProfileFields } from './HealthProfileFields';
import { MemberAvatar } from './MemberAvatar';

type Field = keyof FamilyMemberFormValues;


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
  const { t } = useT();
  const relationshipOptions: readonly ChipOption<Relationship>[] = ADDABLE_RELATIONSHIPS.map(
    (relationship) => ({ value: relationship, label: relationshipLabelT(t, { relationship, customRelationship: null }) }),
  );
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
          {t('familyForm.preview')}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <AppText variant="heading">{isSelf ? t('familyForm.aboutYou') : t('familyForm.whoTheyAre')}</AppText>

        <TextField
          label={t('familyForm.name')}
          value={values.name}
          onChangeText={(name) => setField('name', name)}
          placeholder={isSelf ? t('familyForm.yourName') : t('familyForm.namePlaceholder')}
          error={fieldErrors.name}
          autoCapitalize="words"
          helper={t('familyForm.nameHelper')}
        />

        {isSelf ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textSecondary">
              {t('familyForm.relationship')}
            </AppText>
            <AppText variant="body">{t('familyForm.meOwnProfile')}</AppText>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color={fieldErrors.relationship ? 'dangerText' : 'textSecondary'}>
              {t('familyForm.relationshipToYou')}
            </AppText>
            <ChoiceChips
              options={relationshipOptions}
              value={values.relationship || null}
              onChange={(relationship) => setField('relationship', relationship ?? '')}
              accessibilityLabel={t('familyForm.relationship')}
              allowClear={false}
            />
            {fieldErrors.relationship ? (
              <AppText variant="caption" color="dangerText">
                {localizeMessage(fieldErrors.relationship)}
              </AppText>
            ) : null}
          </View>
        )}

        {values.relationship === 'OTHER' && !isSelf ? (
          <TextField
            label={t('familyForm.howRelated')}
            value={values.customRelationship}
            onChangeText={(customRelationship) => setField('customRelationship', customRelationship)}
            placeholder={t('familyForm.howRelatedPlaceholder')}
            error={fieldErrors.customRelationship}
            autoCapitalize="sentences"
          />
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" color="textSecondary">
            {t('familyForm.avatarColour')}
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
          <AppText variant="heading">{t('familyForm.healthProfile')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('familyForm.allOptional')}
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
        <Button label={t('common.cancel')} onPress={onCancel} variant="secondary" disabled={isSubmitting} />
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
  const { t } = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={avatarColorLabel(t, color)}
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
        {avatarColorLabel(t, color)}
      </AppText>
    </Pressable>
  );
}
