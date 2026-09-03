/**
 * Branded header shared by the login and signup screens.
 */

import { View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeContext';

export type AuthHeaderProps = {
  title: string;
  subtitle: string;
};

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
      {/* Full lockup including the tagline — this is the app's first impression. */}
      <Logo variant="lockup" size={54} showTagline />

      <AppText variant="heading" align="center">
        {title}
      </AppText>

      <AppText variant="body" color="textSecondary" align="center">
        {subtitle}
      </AppText>
    </View>
  );
}
