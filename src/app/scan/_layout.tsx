/**
 * Stack for the scanning flow: camera (or photo picker on the web) → result.
 * Pushed above the tabs with a real header so there is always a way back.
 */

import { Stack } from 'expo-router';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export default function ScanLayout() {
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
      <Stack.Screen name="index" options={{ title: t('header.scan') }} />
      <Stack.Screen name="result" options={{ title: t('header.scanResult') }} />
    </Stack>
  );
}
