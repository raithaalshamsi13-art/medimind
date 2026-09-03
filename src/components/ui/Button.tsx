/**
 * MediMind button.
 *
 * Accessibility choices baked in (Phase 16):
 *   - minimum height comes from theme.touch (56 default, 64 for "large")
 *   - always has a visible text label, never an icon on its own
 *   - reports accessibilityRole / state so screen readers announce it properly
 *   - disabled state changes BOTH colour and opacity, never colour alone
 */

import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'medium' | 'large';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  /** Buttons fill their container by default; set false to hug the label. */
  fullWidth?: boolean;
  /** Extra context for screen readers, e.g. "Opens the camera". */
  accessibilityHint?: string;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isInactive = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string; pressedBg: string }> = {
    primary: {
      bg: theme.colors.primary,
      fg: theme.colors.primaryText,
      border: theme.colors.primary,
      pressedBg: theme.colors.primaryPressed,
    },
    secondary: {
      bg: theme.colors.surface,
      fg: theme.colors.primary,
      border: theme.colors.borderStrong,
      pressedBg: theme.colors.surfaceAlt,
    },
    danger: {
      bg: theme.colors.danger,
      fg: theme.scheme === 'dark' ? theme.colors.dangerSoft : '#FFFFFF',
      border: theme.colors.danger,
      pressedBg: theme.colors.dangerText,
    },
    ghost: {
      bg: 'transparent',
      fg: theme.colors.primary,
      border: 'transparent',
      pressedBg: theme.colors.surfaceAlt,
    },
  };

  const colors = palette[variant];
  const minHeight = size === 'large' ? theme.touch.large : theme.touch.comfortable;
  const iconSize = size === 'large' ? 24 : 20;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: isInactive
            ? theme.colors.surfaceAlt
            : pressed
              ? colors.pressedBg
              : colors.bg,
          borderColor: isInactive ? theme.colors.border : colors.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isInactive ? 0.7 : 1,
        },
        style,
      ]}>
      <View style={[styles.content, { gap: theme.spacing.sm }]}>
        {loading ? (
          <ActivityIndicator size="small" color={isInactive ? theme.colors.textMuted : colors.fg} />
        ) : icon ? (
          <Ionicons
            name={icon}
            size={iconSize}
            color={isInactive ? theme.colors.textMuted : colors.fg}
          />
        ) : null}
        <AppText
          variant="button"
          style={{ color: isInactive ? theme.colors.textMuted : colors.fg }}
          numberOfLines={2}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
