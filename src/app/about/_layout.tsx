/** Stack for informational pages reached from Settings (privacy). */

import { Stack } from 'expo-router';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export default function AboutLayout() {
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
      <Stack.Screen name="privacy" options={{ title: t('header.privacy') }} />
    </Stack>
  );
}
