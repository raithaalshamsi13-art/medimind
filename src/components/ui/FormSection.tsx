/**
 * A titled group of fields inside a long form.
 *
 * Long forms are hard for anyone, and harder for people who tire easily.
 * Splitting the medicine form into five short, numbered sections lets the eye
 * rest between groups and tells the user how far along they are.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

import { AppText } from './AppText';
import { Card } from './Card';

export type FormSectionProps = {
  title: string;
  /** One sentence saying what the section is for. */
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Section number, drawn in a circle before the title. */
  step?: number;
  children: ReactNode;
  style?: ViewStyle;
};

export function FormSection({ title, description, icon, step, children, style }: FormSectionProps) {
  const theme = useTheme();

  return (
    <View style={[{ gap: theme.spacing.md }, style]} accessibilityLabel={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        {step !== undefined ? (
          <View
            accessible={false}
            style={{
              width: 32,
              height: 32,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <AppText variant="label" style={{ color: theme.colors.primaryText }}>
              {step}
            </AppText>
          </View>
        ) : icon ? (
          <Ionicons name={icon} size={24} color={theme.colors.primary} />
        ) : null}
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          {description ? (
            <AppText variant="caption" color="textSecondary">
              {description}
            </AppText>
          ) : null}
        </View>
      </View>

      <Card>
        <View style={{ gap: theme.spacing.lg }}>{children}</View>
      </Card>
    </View>
  );
}
