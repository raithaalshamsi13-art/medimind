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
import { MEDICAL_DISCLAIMER_SHORT } from '@/config/constants';
import { signUpSchema } from '@/domain/user';
import { fieldErrorsOf } from '@/lib/validation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTheme } from '@/theme/ThemeContext';

type SignUpField = 'displayName' | 'email' | 'password';

export default function SignUpScreen() {
  const theme = useTheme();
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
          title="Create your account"
          subtitle="You only need three details to get started."
        />

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        <View style={{ gap: theme.spacing.base }}>
          <TextField
            label="Your name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Omar"
            error={fieldErrors.displayName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            helper="Used to greet you on the home screen."
          />

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            error={fieldErrors.email}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            error={fieldErrors.password}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            helper="At least 8 characters."
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>

        <Button
          label="Create account"
          onPress={onSubmit}
          loading={isSubmitting}
          size="large"
          accessibilityHint="Creates your account and opens your dashboard"
        />

        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="body" color="textSecondary">
            Already have an account?
          </AppText>
          <TextLink label="Log in instead" onPress={() => router.back()} />
        </View>

        <AppText variant="caption" color="textMuted" align="center">
          {MEDICAL_DISCLAIMER_SHORT}
        </AppText>
      </View>
    </Screen>
  );
}
