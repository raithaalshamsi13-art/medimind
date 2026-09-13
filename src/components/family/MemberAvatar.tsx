/**
 * A family member's avatar: their initials on a coloured circle.
 *
 * The colour is a theme role (primary / info / success / warning / danger),
 * so it follows the selected palette and dark mode, and the initials are
 * always drawn — colour is never the only way to tell members apart.
 */

import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { initialsOf, type AvatarColor, type FamilyMember } from '@/domain/familyMember';
import type { ColorTokens } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeContext';

export type MemberAvatarProps = {
  member: Pick<FamilyMember, 'name' | 'avatarColor'>;
  /** Diameter in points. */
  size?: number;
};

const SOFT: Record<AvatarColor, keyof ColorTokens> = {
  primary: 'primarySoft',
  info: 'infoSoft',
  success: 'successSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
};

const TEXT: Record<AvatarColor, keyof ColorTokens> = {
  primary: 'primary',
  info: 'infoText',
  success: 'successText',
  warning: 'warningText',
  danger: 'dangerText',
};

const RING: Record<AvatarColor, keyof ColorTokens> = {
  primary: 'primary',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function MemberAvatar({ member, size = 48 }: MemberAvatarProps) {
  const theme = useTheme();

  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors[SOFT[member.avatarColor]],
        borderWidth: 2,
        borderColor: theme.colors[RING[member.avatarColor]],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <AppText
        variant={size >= 56 ? 'heading' : 'label'}
        weight="700"
        style={{ color: theme.colors[TEXT[member.avatarColor]] }}>
        {initialsOf(member.name)}
      </AppText>
    </View>
  );
}
