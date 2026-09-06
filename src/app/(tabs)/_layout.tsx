/**
 * Bottom tab navigator: Home · Medicines · Ask · Schedule · History · Settings.
 *
 * Labels are hidden in PORTRAIT and shown in LANDSCAPE (a product decision:
 * six tabs on a phone-width screen leave no room for readable text, while a
 * rotated phone has plenty). In landscape the label sits beside its icon so
 * the bar keeps the same height either way.
 *
 * Accessibility notes:
 *   - each tab always keeps its full name as its accessibility label
 *     (`title`), so a screen reader announces "Medicines", "Settings" and so
 *     on even when the visible label is hidden
 *   - the active tab changes both icon shape (outline → filled) and colour, so
 *     selection is not communicated by colour alone
 *   - icons are 28pt inside a 56pt-tall bar, comfortably above the 48pt
 *     minimum touch target
 *
 * Sizing note: the bar's height is set EXPLICITLY from its content plus the
 * bottom safe-area inset. Left to the default on the iPhone web build, the bar
 * extended past the visible area and its bottom row was cut off.
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICON_SIZE = 28;
/** Icon plus vertical padding; unchanged in landscape (label goes beside). */
const TAB_BAR_CONTENT_HEIGHT = 56;

/**
 * Renders the filled icon when active, the outline when inactive.
 * Note: the navigator passes `ColorValue`, not `string`.
 */
function tabIcon(filled: IconName, outline: IconName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? filled : outline} size={TAB_ICON_SIZE} color={color} />
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;

  // Keep a little breathing room even when the device reports no inset
  // (e.g. a phone with a physical home button, or a desktop browser).
  const bottomPadding = Math.max(insets.bottom, theme.spacing.xs);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: isLandscape,
        tabBarLabelPosition: 'beside-icon',
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: TAB_BAR_CONTENT_HEIGHT + bottomPadding,
          paddingTop: theme.spacing.xs,
          paddingBottom: bottomPadding,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginLeft: theme.spacing.sm,
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
          tabBarAccessibilityLabel: 'Ask MediMind',
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
