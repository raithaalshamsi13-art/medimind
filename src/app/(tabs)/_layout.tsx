/**
 * Bottom tab navigator: Home · Medicines · Ask · Schedule · History · Settings.
 *
 * Accessibility notes:
 *   - labels are ALWAYS visible (never icon-only), so the meaning of each tab
 *     is readable rather than guessed from a glyph
 *   - the active tab changes both icon shape (outline → filled) and colour, so
 *     selection is not communicated by colour alone
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Renders the filled icon when active, the outline when inactive.
 * Note: the navigator passes `ColorValue`, not `string`.
 */
function tabIcon(filled: IconName, outline: IconName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? filled : outline} size={26} color={color} />
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingTop: theme.spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: theme.type.caption.fontSize,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="medications"
        options={{ title: 'Medicines', tabBarIcon: tabIcon('medkit', 'medkit-outline') }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Ask',
          tabBarIcon: tabIcon('chatbubble-ellipses', 'chatbubble-ellipses-outline'),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Schedule', tabBarIcon: tabIcon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: tabIcon('time', 'time-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings', 'settings-outline') }}
      />
    </Tabs>
  );
}
