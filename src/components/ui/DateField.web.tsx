/**
 * Labelled date picker (web build).
 *
 * Metro picks this file instead of DateField.tsx when bundling for the
 * browser, so `@react-native-community/datetimepicker` — a native module —
 * never enters the web bundle (the same platform-split rule as
 * `src/db/database.web.ts`).
 *
 * The browser's own `<input type="date">` gives a proper calendar on desktop
 * and the native wheel on a phone browser, and it already produces the exact
 * "yyyy-MM-dd" string we store.
 */

import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';
import { Button } from './Button';

export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  helper?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: ViewStyle;
};

export function DateField({
  label,
  value,
  onChange,
  error,
  helper,
  minimumDate,
  maximumDate,
  style,
}: DateFieldProps) {
  const theme = useTheme();
  const hasError = Boolean(error);
  const isSet = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());

  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      <AppText variant="label" color={hasError ? 'dangerText' : 'textSecondary'}>
        {label}
      </AppText>

      <View
        style={{
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
        <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
        <input
          type="date"
          value={isSet ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          min={minimumDate ? format(minimumDate, 'yyyy-MM-dd') : undefined}
          max={maximumDate ? format(maximumDate, 'yyyy-MM-dd') : undefined}
          aria-label={label}
          aria-invalid={hasError}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: theme.colors.text,
            fontSize: theme.type.body.fontSize,
            fontFamily: 'inherit',
            padding: `${theme.spacing.md}px 0`,
            colorScheme: theme.scheme,
          }}
        />
      </View>

      {isSet ? (
        <Button
          label="Clear date"
          onPress={() => onChange('')}
          variant="ghost"
          icon="close-circle-outline"
          fullWidth={false}
        />
      ) : null}

      {hasError ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'flex-start' }}>
          <Ionicons
            name="alert-circle"
            size={16}
            color={theme.colors.danger}
            style={{ marginTop: 2 }}
          />
          <AppText variant="caption" color="dangerText" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText variant="caption" color="textMuted">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}
