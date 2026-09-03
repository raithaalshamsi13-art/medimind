/**
 * Labelled text input.
 *
 * Accessibility choices (Phase 16 / 17):
 *   - the label is a real visible label, not a placeholder that vanishes when
 *     you start typing
 *   - an error is shown as an icon + sentence, never as a red border alone
 *   - password fields get a large, properly-labelled show/hide toggle
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Validation message. When set, the field renders in its error state. */
  error?: string | null;
  /** Hint shown under the field when there is no error. */
  helper?: string;
  /** Renders a masked input with a show/hide toggle. */
  secure?: boolean;
  editable?: boolean;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  style?: ViewStyle;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  secure = false,
  editable = true,
  multiline = false,
  keyboardType,
  autoComplete,
  autoCapitalize = 'none',
  textContentType,
  returnKeyType,
  onSubmitEditing,
  style,
}: TextFieldProps) {
  const theme = useTheme();
  const [isRevealed, setIsRevealed] = useState(false);

  const hasError = Boolean(error);
  // `borderStrong`, not `border`: an input's boundary is a meaningful UI
  // element and WCAG 1.4.11 asks for 3:1 against its surroundings. The softer
  // `border` token is for decorative edges like card outlines and dividers.
  const borderColor = hasError
    ? theme.colors.danger
    : editable
      ? theme.colors.borderStrong
      : theme.colors.surfaceAlt;

  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      <AppText variant="label" color={hasError ? 'dangerText' : 'textSecondary'}>
        {label}
      </AppText>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceAlt,
          borderWidth: 2,
          borderColor,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.base,
          minHeight: theme.touch.comfortable,
        }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={secure && !isRevealed}
          editable={editable}
          multiline={multiline}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCorrect={false}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          allowFontScaling
          style={{
            flex: 1,
            color: theme.colors.text,
            fontSize: theme.type.body.fontSize,
            paddingVertical: theme.spacing.md,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />

        {secure ? (
          <Pressable
            onPress={() => setIsRevealed((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'}
            hitSlop={12}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons
              name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

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
