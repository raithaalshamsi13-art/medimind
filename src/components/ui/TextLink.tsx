/**
 * Inline textual link.
 *
 * Underlined as well as coloured, so it is identifiable as a link without
 * relying on colour perception. Enforces a 44pt touch height.
 */

import { Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';

export type TextLinkProps = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  style?: ViewStyle;
};

export function TextLink({ label, onPress, accessibilityHint, style }: TextLinkProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={12}
      style={[
        {
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.sm,
        },
        style,
      ]}>
      <AppText
        variant="label"
        style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>
        {label}
      </AppText>
    </Pressable>
  );
}
