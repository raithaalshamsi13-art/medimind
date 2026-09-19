/**
 * Step 2 of sign-up: "Tell us a little about yourself".
 *
 * Shown once, right after an account is created (the auth gate sends a
 * signed-in user here while their "Me" profile has not yet been through this
 * step). Everything is optional and the user can skip; either way the step is
 * marked done so it never reappears. The same details can be edited later
 * from Settings → My profile.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { HealthProfileFields } from '@/components/family/HealthProfileFields';
import { AppText, Button, Card, InlineMessage, Screen } from '@/components/ui';
import {
  EMPTY_HEALTH_PROFILE_FORM,
  healthProfileSchema,
  toHealthProfileFormValues,
  type HealthProfileFormValues,
} from '@/domain/familyMember';
import { useT } from '@/i18n';
import { fieldErrorsOf } from '@/lib/validation';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { selectSelf, useFamilyStore } from '@/stores/useFamilyStore';
import { useTheme } from '@/theme/ThemeContext';

type Field = keyof HealthProfileFormValues;

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const user = useAuthStore(selectUser);
  const self = useFamilyStore(selectSelf);
  const completeProfileSetup = useFamilyStore((state) => state.completeProfileSetup);
  const isSaving = useFamilyStore((state) => state.isSaving);
  const error = useFamilyStore((state) => state.error);

  const [values, setValues] = useState<HealthProfileFormValues>(() =>
    self ? toHealthProfileFormValues(self) : EMPTY_HEALTH_PROFILE_FORM,
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const setField = <K extends Field>(field: K, value: HealthProfileFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const finish = async (save: boolean) => {
    if (!user) return;
    if (!save) {
      const done = await completeProfileSetup(user.id, null);
      if (done) router.replace('/');
      return;
    }
    const parsed = healthProfileSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsOf<Field>(parsed.error));
      return;
    }
    setFieldErrors({});
    const done = await completeProfileSetup(user.id, parsed.data);
    if (done) router.replace('/');
  };

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="person-circle-outline" size={40} color={theme.colors.primary} />
          </View>
          <AppText variant="caption" color="textMuted">
            {t('profileSetup.step')}
          </AppText>
          <AppText variant="title" align="center">
            {t('profileSetup.title')}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {t('profileSetup.subtitle')}
          </AppText>
        </View>

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        <Card>
          <HealthProfileFields
            values={values}
            errors={fieldErrors}
            onChange={(patch) => {
              for (const [field, value] of Object.entries(patch) as [Field, HealthProfileFormValues[Field]][]) {
                setField(field, value);
              }
            }}
          />
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={t('profileSetup.save')}
            icon="checkmark"
            size="large"
            onPress={() => void finish(true)}
            loading={isSaving}
            accessibilityHint={t('profileSetup.saveHint')}
          />
          <Button
            label={t('common.skipForNow')}
            variant="secondary"
            onPress={() => void finish(false)}
            disabled={isSaving}
            accessibilityHint={t('profileSetup.skipHint')}
          />
        </View>
      </View>
    </Screen>
  );
}
