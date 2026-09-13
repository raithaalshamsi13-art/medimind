/**
 * Stack for the family screens that sit above the tabs — same header
 * treatment as the medicine stack.
 */

import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeContext';

export default function FamilyLayout() {
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
      <Stack.Screen name="add" options={{ title: 'Add family member' }} />
      <Stack.Screen name="[id]" options={{ title: 'Family member' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit profile' }} />
    </Stack>
  );
}
