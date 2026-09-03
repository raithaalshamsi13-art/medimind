/**
 * Status pill.
 *
 * IMPORTANT (Phase 16): a Badge always renders its text label. There is no
 * "colour only" mode by design — a red dot must never be the only way a user
 * learns that a medicine is expired.
 */

import { Ionicons } from '@expo/vector-icons';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
};

export function Badge({ label, tone = 'neutral', icon, style }: BadgeProps) {
  const theme = useTheme();

  const tones: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
    neutral: {
      bg: theme.colors.surfaceAlt,
      fg: theme.colors.textSecondary,
      border: theme.colors.border,
    },
    success: {
      bg: theme.colors.successSoft,
      fg: theme.colors.successText,
      border: theme.colors.success,
    },
    warning: {
      bg: theme.colors.warningSoft,
      fg: theme.colors.warningText,
      border: theme.colors.warning,
    },
    danger: {
      bg: theme.colors.dangerSoft,
      fg: theme.colors.dangerText,
      border: theme.colors.danger,
    },
    info: {
      bg: theme.colors.infoSoft,
      fg: theme.colors.infoText,
      border: theme.colors.info,
    },
  };

  const c = tones[tone];

  return (
    <View
      // Group the icon + label so a screen reader reads one phrase.
      accessible
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: theme.spacing.xs,
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs + 2,
        },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={14} color={c.fg} /> : null}
      <AppText variant="caption" style={{ color: c.fg }} weight="700">
        {label}
      </AppText>
    </View>
  );
}
