/**
 * A section that starts folded and opens on tap.
 *
 * Used for the optional parts of a long form (extra instructions, notes) so
 * the screen a person first sees stays short. The header is a full-width
 * 56pt button with a chevron AND a written "Add" / "Hide" hint, and it reports
 * its expanded state to screen readers.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type CollapsibleProps = {
  title: string;
  /** Short preview shown while folded, e.g. the note's first line. */
  summary?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Start open — used when the section already holds a value. */
  defaultOpen?: boolean;
  children: ReactNode;
  style?: ViewStyle;
};

export function Collapsible({
  title,
  summary,
  icon,
  defaultOpen = false,
  children,
  style,
}: CollapsibleProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
        },
        style,
      ]}>
      <Pressable
        onPress={() => setIsOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={title}
        accessibilityHint={isOpen ? 'Hides this section' : 'Shows this section'}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: theme.touch.comfortable,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.md,
          backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
        })}>
        {icon ? <Ionicons name={icon} size={22} color={theme.colors.primary} /> : null}
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="subheading">{title}</AppText>
          {!isOpen && summary ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {summary}
            </AppText>
          ) : null}
        </View>
        <AppText variant="label" color="primary">
          {isOpen ? 'Hide' : summary ? 'Edit' : 'Add'}
        </AppText>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={theme.colors.primary}
        />
      </Pressable>

      {isOpen ? (
        <View
          style={{
            padding: theme.spacing.base,
            paddingTop: theme.spacing.xs,
            gap: theme.spacing.lg,
          }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}
