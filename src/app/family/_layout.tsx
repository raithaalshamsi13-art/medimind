/**
 * Stack for the family screens that sit above the tabs — same header
 * treatment as the medicine stack.
 */

import { Stack } from 'expo-router';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export default function FamilyLayout() {
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
      <Stack.Screen name="add" options={{ title: t('header.addFamilyMember') }} />
      <Stack.Screen name="[id]" options={{ title: t('header.familyMember') }} />
      <Stack.Screen name="edit/[id]" options={{ title: t('header.editProfile') }} />
    </Stack>
  );
}
