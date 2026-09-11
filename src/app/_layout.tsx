/**
 * Root layout — the outermost shell of MediMind.
 *
 * Responsibilities:
 *   1. install app-wide providers (safe area, theme)
 *   2. run the launch sequence, holding the native splash screen until both
 *      preferences and the saved session have been read from storage
 *   3. route the user to the right place: onboarding → login → app
 */

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/stores/useAuthStore';
import { useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { AppThemeProvider, useTheme } from '@/theme/ThemeContext';

// Hold the native splash until the launch sequence finishes, so the user never
// sees onboarding flash before we know they have already completed it.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (e.g. after a fast refresh) — nothing to do.
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Split out from RootLayout because it calls useTheme(), which requires being
 * inside AppThemeProvider.
 */
function RootNavigator() {
  const theme = useTheme();

  const authStatus = useAuthStore((state) => state.status);
  const isSignedIn = useAuthStore((state) => state.session !== null);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);

  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const loadMedications = useMedicationStore((state) => state.load);
  const clearMedications = useMedicationStore((state) => state.clear);
  const loadConditions = useHealthConditionStore((state) => state.load);
  const clearConditions = useHealthConditionStore((state) => state.clear);

  const isSettingsHydrated = useSettingsStore((state) => state.isHydrated);
  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding);
  const loadSettings = useSettingsStore((state) => state.load);

  /** Both stores have finished reading from encrypted storage. */
  const isReady = authStatus === 'ready' && isSettingsHydrated;

  // Launch sequence. Runs once; the two reads are independent so they overlap.
  useEffect(() => {
    void loadSettings();
    void bootstrapAuth();
  }, [bootstrapAuth, loadSettings]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  // Load this user's medicines once they are signed in, and drop them from
  // memory on sign-out so the next account never sees the previous one's data.
  useEffect(() => {
    if (userId) {
      void loadMedications(userId);
      void loadConditions(userId);
    } else {
      clearMedications();
      clearConditions();
    }
  }, [userId, loadMedications, clearMedications, loadConditions, clearConditions]);

  useAuthGate({ isReady, isSignedIn, hasCompletedOnboarding });

  // Render nothing while the native splash is still covering the screen.
  if (!isReady) return null;

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: theme.type.subheading.fontSize,
          },
        }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

/**
 * Keeps the current route consistent with the user's state.
 *
 * Ordering matters: onboarding is checked before authentication, so a
 * first-time user sees what the app does before being asked to make an account.
 */
function useAuthGate({
  isReady,
  isSignedIn,
  hasCompletedOnboarding,
}: {
  isReady: boolean;
  isSignedIn: boolean;
  hasCompletedOnboarding: boolean;
}) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    const group = segments[0];
    const isOnOnboarding = group === 'onboarding';
    const isInAuthFlow = group === '(auth)';

    if (!hasCompletedOnboarding) {
      if (!isOnOnboarding) router.replace('/onboarding');
      return;
    }

    if (!isSignedIn) {
      if (!isInAuthFlow) router.replace('/login');
      return;
    }

    // Signed in, but sitting on a pre-auth screen — send them to the dashboard.
    if (isInAuthFlow || isOnOnboarding) {
      router.replace('/');
    }
  }, [isReady, isSignedIn, hasCompletedOnboarding, segments, router]);
}
