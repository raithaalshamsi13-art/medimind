/**
 * Sign-up screen.
 *
 * Deliberately minimal: name, email, password. Collecting the least personal
 * data that still makes the app work is a Phase 18 requirement — MediMind has
 * no need for a date of birth, phone number or address.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/components/auth/AuthHeader';
import { AppText, Button, InlineMessage, Screen, TextField, TextLink } from '@/components/ui';
import { signUpSchema } from '@/domain/user';
import { fieldErrorsOf } from '@/lib/validation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

type SignUpField = 'displayName' | 'email' | 'password';

export default function SignUpScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();

  const signUp = useAuthStore((state) => state.signUp);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignUpField, string>>>({});

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async () => {
    clearError();

    const parsed = signUpSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsOf<SignUpField>(parsed.error));
      return;
    }

    setFieldErrors({});
    // On success the auth gate redirects to the dashboard.
    await signUp({ displayName, email, password });
  };

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
        <AuthHeader
          title={t('auth.signup.title')}
          subtitle={t('auth.signup.subtitle')}
        />

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        <View style={{ gap: theme.spacing.base }}>
          <TextField
            label={t('auth.signup.yourName')}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('auth.signup.namePlaceholder')}
            error={fieldErrors.displayName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            helper={t('auth.signup.nameHelper')}
          />

          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            error={fieldErrors.email}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.signup.passwordPlaceholder')}
            error={fieldErrors.password}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            helper={t('auth.signup.passwordHelper')}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>

        <Button
          label={t('auth.signup.button')}
          onPress={onSubmit}
          loading={isSubmitting}
          size="large"
          accessibilityHint={t('auth.signup.buttonHint')}
        />

        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="body" color="textSecondary">
            {t('auth.signup.haveAccount')}
          </AppText>
          <TextLink label={t('auth.signup.logInInstead')} onPress={() => router.back()} />
        </View>

        <AppText variant="caption" color="textMuted" align="center">
          {t('disclaimer.short')}
        </AppText>
      </View>
    </Screen>
  );
}
