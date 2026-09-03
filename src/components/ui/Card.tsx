/**
 * Surface container used for dashboard tiles, medication rows and dose rows.
 *
 * Pass `onPress` to make it an accessible tappable row (it then enforces the
 * minimum touch target automatically).
 */

import { type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  /** Screen-reader label for a tappable card. Required when onPress is set. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Emphasise the card with a coloured left edge — pair with a text label. */
  accentColor?: string;
  padded?: boolean;
  style?: ViewStyle;
};

export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accentColor,
  padded = true,
  style,
}: CardProps) {
  const theme = useTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.base : 0,
    ...(accentColor
      ? { borderLeftWidth: 6, borderLeftColor: accentColor }
      : null),
  };

  if (!onPress) {
    return <View style={[baseStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        baseStyle,
        { minHeight: theme.touch.comfortable },
        pressed && { backgroundColor: theme.colors.surfaceAlt },
        style,
      ]}>
      {children}
    </Pressable>
  );
}
