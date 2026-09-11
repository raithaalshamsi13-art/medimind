/**
 * Stack for the health screens that sit above the tabs — same header
 * treatment as the medicine stack, for the same reason: these are pushed
 * screens and need an obvious way back.
 */

import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeContext';

export default function HealthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: theme.colors.background },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          color: theme.colors.text,
          fontWeight: '700',
          fontSize: theme.type.subheading.fontSize,
        },
      }}>
      <Stack.Screen name="conditions" options={{ title: 'My health conditions' }} />
    </Stack>
  );
}
