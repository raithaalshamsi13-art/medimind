/**
 * A single-choice list of options.
 *
 * Rendered as full-width rows rather than a compact segmented control, because
 * segmented controls squeeze labels into a few points of width — bad for the
 * older users MediMind targets, and impossible to caption.
 *
 * Selection is shown by a filled radio AND a border change AND (optionally) a
 * colour swatch, never by colour alone. Each row reports
 * `accessibilityRole="radio"` with its checked state, so a screen reader
 * announces "selected".
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
  /** Two colours drawn as a small preview, used by the palette picker. */
  swatch?: readonly [string, string];
  icon?: keyof typeof Ionicons.glyphMap;
};

export type OptionGroupProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Describes the whole group for screen readers, e.g. "Appearance". */
  accessibilityLabel: string;
  style?: ViewStyle;
};

export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: OptionGroupProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[{ gap: theme.spacing.sm }, style]}>
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              minHeight: theme.touch.comfortable,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              borderWidth: 2,
              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              backgroundColor: pressed
                ? theme.colors.surfaceAlt
                : isSelected
                  ? theme.colors.primarySoft
                  : theme.colors.surface,
            })}>
            {option.swatch ? (
              <View
                style={{
                  flexDirection: 'row',
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.sm,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: theme.colors.borderStrong,
                }}>
                <View style={{ flex: 1, backgroundColor: option.swatch[0] }} />
                <View style={{ flex: 1, backgroundColor: option.swatch[1] }} />
              </View>
            ) : option.icon ? (
              <Ionicons
                name={option.icon}
                size={24}
                color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
              />
            ) : null}

            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="subheading">{option.label}</AppText>
              {option.description ? (
                <AppText variant="caption" color="textSecondary">
                  {option.description}
                </AppText>
              ) : null}
            </View>

            <Ionicons
              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={isSelected ? theme.colors.primary : theme.colors.borderStrong}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
