/**
 * Labelled time picker (native build) — the clock-time sibling of DateField.
 *
 * Values in and out are "HH:mm" (24-hour) strings, shown as "8:00 AM". The
 * web build lives in TimeField.web.tsx and uses the browser's time input.
 */

import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { formatClockTime } from '@/lib/datetime';
import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';
import { Button } from './Button';

export type TimeFieldProps = {
  label: string;
  /** "HH:mm" */
  value: string;
  onChange: (value: string) => void;
  /** Optional trailing action, e.g. remove this time. */
  onRemove?: () => void;
  error?: string | null;
  style?: ViewStyle;
};

function toDate(value: string): Date {
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
  return date;
}

function toValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TimeField({ label, value, onChange, onRemove, error, style }: TimeFieldProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const hasError = Boolean(error);

  const handlePicked = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setIsOpen(false);
    if (event.type === 'set' && picked) onChange(toValue(picked));
  };

  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      <AppText variant="label" color={hasError ? 'dangerText' : 'textSecondary'}>
        {label}
      </AppText>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Pressable
          onPress={() => setIsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatClockTime(value)}`}
          accessibilityHint="Opens a clock to choose the time"
          accessibilityState={{ expanded: isOpen }}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            minHeight: theme.touch.comfortable,
            paddingHorizontal: theme.spacing.base,
            borderRadius: theme.radius.md,
            borderWidth: 2,
            borderColor: hasError
              ? theme.colors.danger
              : isOpen
                ? theme.colors.primary
                : theme.colors.borderStrong,
            backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
          })}>
          <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
          <AppText variant="bodyLarge" style={{ flex: 1 }}>
            {formatClockTime(value)}
          </AppText>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
        </Pressable>

        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${formatClockTime(value)}`}
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

      {isOpen ? (
        <View style={{ gap: theme.spacing.sm }}>
          <DateTimePicker
            value={toDate(value)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handlePicked}
            minuteInterval={5}
            accentColor={theme.colors.primary}
            themeVariant={theme.scheme}
          />
          {Platform.OS === 'ios' ? (
            <Button label="Done" onPress={() => setIsOpen(false)} variant="secondary" icon="checkmark" />
          ) : null}
        </View>
      ) : null}

      {hasError ? (
        <AppText variant="caption" color="dangerText">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
