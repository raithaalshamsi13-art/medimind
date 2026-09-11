/**
 * Chip pickers — a row of pill buttons that wraps onto as many lines as it
 * needs. Two variants share one look:
 *
 *   ChoiceChips       pick ONE (radio semantics; tap again to clear)
 *   MultiChoiceChips  pick ANY (checkbox semantics)
 *
 * WHY CHIPS AND NOT A DROPDOWN
 * A dropdown hides its options behind a tap and its native picker looks
 * different on every platform. Chips show every option at once in large,
 * readable text, and each one is a full-size (48pt+) touch target — better
 * for the older users MediMind targets.
 *
 * Selection is shown three ways — filled background, stronger border and a
 * checkmark icon — never by colour alone, and each chip reports its checked
 * state to screen readers.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type ChipProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  role: 'radio' | 'checkbox';
  onPress: () => void;
};

function Chip({ label, icon, selected, role, onPress }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: theme.touch.minTarget,
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        borderWidth: 2,
        borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
        backgroundColor: pressed
          ? theme.colors.surfaceAlt
          : selected
            ? theme.colors.primarySoft
            : theme.colors.surface,
      })}>
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={selected ? theme.colors.primary : theme.colors.textSecondary}
        />
      ) : null}
      <AppText
        variant="label"
        color={selected ? 'primary' : 'text'}
        weight={selected ? '700' : '600'}>
        {label}
      </AppText>
      {selected ? <Ionicons name="checkmark" size={18} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}

function useRowStyle(style?: ViewStyle): ViewStyle {
  const theme = useTheme();
  return { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, ...style };
}

// ---------------------------------------------------------------------------

export type ChoiceChipsProps<T extends string> = {
  options: readonly ChipOption<T>[];
  /** Null when nothing is chosen. */
  value: T | null;
  onChange: (value: T | null) => void;
  /** Describes the group for screen readers, e.g. "Medicine form". */
  accessibilityLabel: string;
  /** Tapping the selected chip clears it. On by default: "not chosen" is a valid answer. */
  allowClear?: boolean;
  style?: ViewStyle;
};

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  allowClear = true,
  style,
}: ChoiceChipsProps<T>) {
  const rowStyle = useRowStyle(style);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={rowStyle}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Chip
            key={option.value}
            label={option.label}
            icon={option.icon}
            selected={selected}
            role="radio"
            onPress={() => onChange(selected && allowClear ? null : option.value)}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

export type MultiChoiceChipsProps<T extends string> = {
  options: readonly ChipOption<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  accessibilityLabel: string;
  style?: ViewStyle;
};

export function MultiChoiceChips<T extends string>({
  options,
  values,
  onChange,
  accessibilityLabel,
  style,
}: MultiChoiceChipsProps<T>) {
  const rowStyle = useRowStyle(style);

  const toggle = (value: T) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      // Keep the option list's order so the result is stable regardless of
      // the order the user tapped in.
      const next = new Set([...values, value]);
      onChange(options.map((o) => o.value).filter((v) => next.has(v)));
    }
  };

  return (
    <View accessibilityLabel={accessibilityLabel} style={rowStyle}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          icon={option.icon}
          selected={values.includes(option.value)}
          role="checkbox"
          onPress={() => toggle(option.value)}
        />
      ))}
    </View>
  );
}
