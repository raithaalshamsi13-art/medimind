/**
 * Labelled date picker (native build).
 *
 * The field itself is a big button that reads "30 Apr 2027" (or "Choose a
 * date"). Tapping it opens the platform calendar — an inline calendar on iOS,
 * the standard dialog on Android — so nobody has to type a date in a
 * particular format and get told off for it.
 *
 * Values in and out are "yyyy-MM-dd" strings, matching how expiry dates are
 * stored; "" means no date. The web build lives in DateField.web.tsx and
 * uses the browser's own date input, so this native module never reaches the
 * web bundle.
 */

import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';
import { Button } from './Button';

export type DateFieldProps = {
  label: string;
  /** "yyyy-MM-dd" or "" for none. */
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  helper?: string;
  /** Earliest / latest selectable date. */
  minimumDate?: Date;
  maximumDate?: Date;
  style?: ViewStyle;
};

function toDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const selected = toDate(value);
  const hasError = Boolean(error);
  const display = selected ? format(selected, 'd MMM yyyy') : 'Choose a date';

  const handlePicked = (event: DateTimePickerEvent, picked?: Date) => {
    // Android fires "dismissed" when the dialog is cancelled; iOS's inline
    // calendar only ever fires "set".
    if (Platform.OS === 'android') setIsPickerOpen(false);
    if (event.type === 'set' && picked) {
      onChange(format(picked, 'yyyy-MM-dd'));
    }
  };

  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      <AppText variant="label" color={hasError ? 'dangerText' : 'textSecondary'}>
        {label}
      </AppText>

      <Pressable
        onPress={() => setIsPickerOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? display : 'not set'}`}
        accessibilityHint="Opens a calendar to choose the date"
        accessibilityState={{ expanded: isPickerOpen }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: theme.touch.comfortable,
          paddingHorizontal: theme.spacing.base,
          borderRadius: theme.radius.md,
          borderWidth: 2,
          borderColor: hasError
            ? theme.colors.danger
            : isPickerOpen
              ? theme.colors.primary
              : theme.colors.borderStrong,
          backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
        })}>
        <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
        <AppText
          variant="body"
          color={selected ? 'text' : 'textMuted'}
          style={{ flex: 1 }}>
          {display}
        </AppText>
        <Ionicons
          name={isPickerOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      {isPickerOpen ? (
        <View style={{ gap: theme.spacing.sm }}>
          <DateTimePicker
            value={selected ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handlePicked}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            accentColor={theme.colors.primary}
            themeVariant={theme.scheme}
          />
          {Platform.OS === 'ios' ? (
            <Button
              label="Done"
              onPress={() => setIsPickerOpen(false)}
              variant="secondary"
              icon="checkmark"
            />
          ) : null}
        </View>
      ) : null}

      {selected ? (
        <Button
          label="Clear date"
          onPress={() => {
            onChange('');
            setIsPickerOpen(false);
          }}
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
