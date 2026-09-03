/**
 * Honest placeholder for routes that exist in the navigation structure but are
 * implemented in a later milestone.
 *
 * Having these keeps the app runnable and navigable at every stage (project
 * rule: BUILD → RUN → TEST → FIX → CONTINUE) instead of leaving dead tabs that
 * crash when tapped.
 */

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText, Badge, Screen } from '@/components/ui';
import { useTheme } from '@/theme/ThemeContext';

export type PlaceholderScreenProps = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** e.g. "Milestone 3" — tells you where this screen gets built. */
  milestone: string;
};

export function PlaceholderScreen({
  title,
  description,
  icon,
  milestone,
}: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <Screen center>
      <View style={{ alignItems: 'center', gap: theme.spacing.base }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={icon} size={44} color={theme.colors.primary} />
        </View>

        <AppText variant="title" align="center">
          {title}
        </AppText>

        <AppText variant="body" color="textSecondary" align="center">
          {description}
        </AppText>

        <Badge label={`Coming in ${milestone}`} tone="info" icon="construct-outline" />
      </View>
    </Screen>
  );
}
