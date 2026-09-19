/**
 * Stack for the reminder screen — same header treatment as the medicine
 * stack.
 */

import { Stack } from 'expo-router';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export default function ReminderLayout() {
  const theme = useTheme();
  const { t } = useT();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: t('common.goBack'),
        contentStyle: { backgroundColor: theme.colors.background },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          color: theme.colors.text,
          fontWeight: '700',
          fontSize: theme.type.subheading.fontSize,
        },
      }}>
      <Stack.Screen name="[medicationId]" options={{ title: t('header.reminder') }} />
    </Stack>
  );
}
