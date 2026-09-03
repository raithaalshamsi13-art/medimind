/**
 * Layout for the unauthenticated screens (login, signup).
 *
 * A plain headerless stack — the screens draw their own branded header, which
 * looks better than a system title bar on a login screen.
 */

import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeContext';

export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
