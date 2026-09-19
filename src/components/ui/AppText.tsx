/**
 * The only text component in MediMind.
 *
 * Screens never use react-native's <Text> directly — going through AppText
 * guarantees every string picks up the themed type scale (including the user's
 * "Large text" setting) and a themed colour.
 */

import { Text, type TextProps, type TextStyle } from 'react-native';

import { useT } from '@/i18n';
import type { ColorTokens } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeContext';
import type { TypeVariant } from '@/theme/typography';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  /** Any colour token name, e.g. "text", "textSecondary", "dangerText". */
  color?: keyof ColorTokens;
  align?: TextStyle['textAlign'];
  /** Convenience override — prefer a variant where possible. */
  weight?: TextStyle['fontWeight'];
};

export function AppText({
  variant = 'body',
  color = 'text',
  align,
  weight,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const spec = theme.type[variant];
  const { isRTL } = useT();

  return (
    <Text
      // Respect the OS font-size setting on top of our own scale.
      allowFontScaling
      style={[
        {
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          fontWeight: weight ?? spec.fontWeight,
          letterSpacing: isRTL ? 0 : spec.letterSpacing,
          color: theme.colors[color],
          textAlign: align,
          // Arabic reads right-to-left even before the layout has flipped.
          writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
      {...rest}
    />
  );
}
