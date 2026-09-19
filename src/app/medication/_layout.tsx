/**
 * Stack for the medicine screens that sit above the tabs.
 *
 * These use a real header with a back button — unlike the tab screens, which
 * draw their own titles — because they are pushed screens and the user needs an
 * obvious way back.
 */

import { Stack } from 'expo-router';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export default function MedicationLayout() {
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
      <Stack.Screen name="add" options={{ title: t('header.addMedicine') }} />
      <Stack.Screen name="[id]" options={{ title: t('header.medicine') }} />
      <Stack.Screen name="edit/[id]" options={{ title: t('header.editMedicine') }} />
    </Stack>
  );
}
