/**
 * Login screen.
 *
 * On success we do NOT navigate imperatively — the auth gate in the root layout
 * notices the new session and redirects. That keeps a single source of truth
 * for routing decisions.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/components/auth/AuthHeader';
import {
  AppText,
  Badge,
  Button,
  Card,
  InlineMessage,
  Screen,
  TextField,
  TextLink,
} from '@/components/ui';
import { DEMO_ACCOUNT } from '@/config/demo';
import { signInSchema } from '@/domain/user';
import { fieldErrorsOf } from '@/lib/validation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

type LoginField = 'email' | 'password';

export default function LoginScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();

  const signIn = useAuthStore((state) => state.signIn);
  const signInAsDemo = useAuthStore((state) => state.signInAsDemo);
  const demoMode = useSettingsStore((state) => state.demoMode);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const isLocalOnly = useAuthStore((state) => state.isLocalOnly);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginField, string>>>({});

  // Drop any error left over from a previous screen.
  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async () => {
    clearError();

    // Client-side check first, so obvious mistakes get a per-field message
    // instead of a generic banner. The service validates again regardless.
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsOf<LoginField>(parsed.error));
      return;
    }

    setFieldErrors({});
    await signIn({ email, password });
  };

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xxl }}>
        <AuthHeader
          title={t('auth.login.title')}
          subtitle={t('auth.login.subtitle')}
        />

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        <View style={{ gap: theme.spacing.base }}>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            error={fieldErrors.email}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.login.passwordPlaceholder')}
            error={fieldErrors.password}
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>

        <Button
          label={t('auth.login.button')}
          onPress={onSubmit}
          loading={isSubmitting}
          size="large"
          accessibilityHint={t('auth.login.buttonHint')}
        />

        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="body" color="textSecondary">
            {t('auth.login.newHere')}
          </AppText>
          <TextLink label={t('auth.login.createAccount')} onPress={() => router.push('/signup')} />
        </View>

        {/* ---------- Demo account (Phase 19) ----------
            Only while Demo Mode is on. The credentials are shown openly: the
            account is created on this device through the normal sign-up path
            the first time the button is pressed, so there is nothing hidden. */}
        {demoMode ? (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Badge label={t('auth.login.demoMode')} tone="info" icon="flask-outline" />
              <AppText variant="body" color="textSecondary">
                {t('auth.login.demoBody')}
              </AppText>
              <View style={{ gap: theme.spacing.xxs }}>
                <AppText variant="caption" color="textMuted">
                  {t('auth.login.demoEmail', { email: DEMO_ACCOUNT.email })}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {t('auth.login.demoPassword', { password: DEMO_ACCOUNT.password })}
                </AppText>
              </View>
              <Button
                label={t('auth.login.useDemo')}
                icon="person-circle-outline"
                variant="secondary"
                onPress={() => void signInAsDemo()}
                loading={isSubmitting}
                accessibilityHint={t('auth.login.useDemoHint')}
              />
            </View>
          </Card>
        ) : null}

        {isLocalOnly ? (
          <AppText variant="caption" color="textMuted" align="center">
            {t('auth.login.localOnly')}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}
