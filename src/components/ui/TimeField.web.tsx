/**
 * Labelled time picker (web build) — the browser's own `<input type="time">`,
 * so the native picker module never enters the web bundle.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, type ViewStyle } from 'react-native';

import { formatClockTime } from '@/lib/datetime';
import { useT } from '@/i18n';
import { localizeMessage } from '@/i18n/labels';
import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  error?: string | null;
  style?: ViewStyle;
};

export function TimeField({ label, value, onChange, onRemove, error, style }: TimeFieldProps) {
  const theme = useTheme();
  const { t } = useT();
  const hasError = Boolean(error);

  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      <AppText variant="label" color={hasError ? 'dangerText' : 'textSecondary'}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            minHeight: theme.touch.comfortable,
            paddingHorizontal: theme.spacing.base,
            borderRadius: theme.radius.md,
            borderWidth: 2,
            borderColor: hasError ? theme.colors.danger : theme.colors.borderStrong,
            backgroundColor: theme.colors.surface,
          }}>
          <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
          <input
            type="time"
            value={value}
            step={300}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value.slice(0, 5));
            }}
            aria-label={label}
            aria-invalid={hasError}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: theme.colors.text,
              fontSize: theme.type.bodyLarge.fontSize,
              fontFamily: 'inherit',
              padding: `${theme.spacing.md}px 0`,
              colorScheme: theme.scheme,
            }}
          />
        </View>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={t('reminder.removeTime', { time: formatClockTime(value) })}
            style={({ pressed }) => ({
              width: theme.touch.comfortable,
              height: theme.touch.comfortable,
              borderRadius: theme.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
            })}>
            <Ionicons name="close-circle-outline" size={26} color={theme.colors.danger} />
          </Pressable>
        ) : null}
      </View>
      {hasError ? (
        <AppText variant="caption" color="dangerText">
          {localizeMessage(error ?? '')}
        </AppText>
      ) : null}
    </View>
  );
}
