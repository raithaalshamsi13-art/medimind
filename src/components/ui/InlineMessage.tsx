/**
 * Inline banner for errors, warnings and confirmations.
 *
 * Used for form errors now, and it is the same component that carries the
 * expired-medicine warning in Phase 7. It always renders an icon AND text, so
 * the meaning survives for a colour-blind user or a black-and-white printout.
 */

import { Ionicons } from '@expo/vector-icons';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type InlineMessageTone = 'info' | 'success' | 'warning' | 'danger';

export type InlineMessageProps = {
  message: string;
  tone?: InlineMessageTone;
  /** Optional bold heading, e.g. "MEDICATION EXPIRED". */
  title?: string;
  style?: ViewStyle;
};

const DEFAULT_ICONS: Record<InlineMessageTone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
};

export function InlineMessage({ message, tone = 'info', title, style }: InlineMessageProps) {
  const theme = useTheme();

  const palette: Record<InlineMessageTone, { bg: string; fg: string; border: string }> = {
    info: { bg: theme.colors.infoSoft, fg: theme.colors.infoText, border: theme.colors.info },
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
  };

  const c = palette[tone];

  return (
    <View
      // Announced as a single unit, and as an alert for warnings/errors.
      accessible
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'text'}
      accessibilityLabel={title ? `${title}. ${message}` : message}
      style={[
        {
          flexDirection: 'row',
          gap: theme.spacing.md,
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: 1,
          borderLeftWidth: 5,
          borderRadius: theme.radius.md,
          padding: theme.spacing.base,
        },
        style,
      ]}>
      <Ionicons name={DEFAULT_ICONS[tone]} size={22} color={c.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        {title ? (
          <AppText variant="subheading" style={{ color: c.fg }}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="body" style={{ color: c.fg }}>
          {message}
        </AppText>
      </View>
    </View>
  );
}
