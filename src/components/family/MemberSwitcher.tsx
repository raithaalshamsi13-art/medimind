/**
 * Chip row for choosing which family member a screen shows.
 *
 * Sits at the top of the Medicines tab and the assistant. Each chip carries
 * the member's avatar and name so the active person is obvious at a glance.
 */

import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { FamilyMember } from '@/domain/familyMember';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

import { MemberAvatar } from './MemberAvatar';

export type MemberSwitcherProps = {
  members: FamilyMember[];
  activeMemberId: string | null;
  onSelect: (memberId: string) => void;
};

export function MemberSwitcher({ members, activeMemberId, onSelect }: MemberSwitcherProps) {
  const theme = useTheme();
  const { t } = useT();

  // One member (just "Me") needs no switcher.
  if (members.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('header.familyMember')}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.xxs }}>
      {members.map((member) => {
        const selected = member.id === activeMemberId;
        return (
          <Pressable
            key={member.id}
            onPress={() => onSelect(member.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={member.name}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              minHeight: theme.touch.minTarget,
              paddingLeft: theme.spacing.xs,
              paddingRight: theme.spacing.base,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radius.pill,
              borderWidth: 2,
              borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
              backgroundColor: pressed
                ? theme.colors.surfaceAlt
                : selected
                  ? theme.colors.primarySoft
                  : theme.colors.surface,
            })}>
            <MemberAvatar member={member} size={32} />
            <View>
              <AppText
                variant="label"
                color={selected ? 'primary' : 'text'}
                weight={selected ? '700' : '600'}>
                {member.isSelf ? t('common.me') : member.name}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
