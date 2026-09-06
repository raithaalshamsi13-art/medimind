/**
 * Stack for the assistant screen — a real header with a back button, since it
 * is pushed on top of the tabs.
 */

import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeContext';

export default function AssistantLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Ask MediMind' }} />
    </Stack>
  );
}
