/**
 * "Adding medicine for: Mother" — the strip that tells the user whose data a
 * screen is showing or about to change.
 *
 * It is rendered on every medicine, condition and assistant screen, because
 * the one thing the Family feature must not allow is quietly saving a
 * medicine under the wrong person. The banner names the member, shows their
 * avatar, and (optionally) offers a one-tap way to switch.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { FamilyMember } from '@/domain/familyMember';
import { useT } from '@/i18n';
import { relationshipLabelT } from '@/i18n/labels';
import { useTheme } from '@/theme/ThemeContext';

import { MemberAvatar } from './MemberAvatar';

export type MemberContextBannerProps = {
  member: FamilyMember;
  /** e.g. "Adding medicine for", "Showing medicines for". */
  prefix: string;
  /** When given, a "Change" affordance opens the switcher. */
  onChange?: () => void;
};

export function MemberContextBanner({ member, prefix, onChange }: MemberContextBannerProps) {
  const theme = useTheme();
  const { t } = useT();

  const content = (
    <>
      <MemberAvatar member={member} size={40} />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="caption" color="textSecondary">
          {prefix}
        </AppText>
        <AppText variant="subheading">
          {member.name}
          {member.isSelf ? '' : ` · ${relationshipLabelT(t, member)}`}
        </AppText>
      </View>
      {onChange ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="label" color="primary">
            {t('common.change')}
          </AppText>
          <Ionicons name="swap-horizontal" size={20} color={theme.colors.primary} />
        </View>
      ) : null}
    </>
  );

  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    minHeight: theme.touch.comfortable,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  };

  if (!onChange) {
    return (
      <View accessible accessibilityLabel={`${prefix} ${member.name}`} style={style}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="button"
      accessibilityLabel={`${prefix} ${member.name}. ${t('member.changeHint')}`}
      style={({ pressed }) => [style, pressed && { backgroundColor: theme.colors.surfaceAlt }]}>
      {content}
    </Pressable>
  );
}
