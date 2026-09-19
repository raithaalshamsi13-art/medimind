/**
 * The Family tab: everyone whose medicines this account manages.
 *
 * "Me" is always present (created on first load), so the list is never truly
 * empty; the welcoming empty state appears until a second person is added.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { MemberAvatar } from '@/components/family/MemberAvatar';
import { AppText, Badge, Button, Card, InlineMessage, Screen } from '@/components/ui';
import { ageOf, type FamilyMember } from '@/domain/familyMember';
import { useT } from '@/i18n';
import { genderLabel, relationshipLabelT, tCount } from '@/i18n/labels';
import {
  selectActiveMemberId,
  selectMembers,
  useFamilyStore,
} from '@/stores/useFamilyStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { selectMedications, useMedicationStore } from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

export default function FamilyScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const error = useFamilyStore((state) => state.error);
  const medications = useMedicationStore(selectMedications);
  const conditions = useHealthConditionStore(selectConditions);

  // Per-member counts, derived once per change rather than per card.
  const counts = useMemo(() => {
    const map = new Map<string, { medicines: number; conditions: number }>();
    for (const member of members) map.set(member.id, { medicines: 0, conditions: 0 });
    for (const m of medications) {
      const entry = m.memberId ? map.get(m.memberId) : undefined;
      if (entry && !m.archived) entry.medicines += 1;
    }
    for (const c of conditions) {
      const entry = c.memberId ? map.get(c.memberId) : undefined;
      if (entry) entry.conditions += 1;
    }
    return map;
  }, [members, medications, conditions]);

  const onlyMe = members.length <= 1;

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">{t('family.title')}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('family.intro')}
          </AppText>
        </View>

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        <View style={{ gap: theme.spacing.md }}>
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isActive={member.id === activeMemberId}
              medicineCount={counts.get(member.id)?.medicines ?? 0}
              conditionCount={counts.get(member.id)?.conditions ?? 0}
              onPress={() => router.push({ pathname: '/family/[id]', params: { id: member.id } })}
            />
          ))}
        </View>

        {onlyMe ? (
          <Card>
            <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
              <Ionicons name="people-outline" size={44} color={theme.colors.primary} />
              <AppText variant="heading" align="center">
                {t('family.manageTitle')}
              </AppText>
              <AppText variant="body" color="textSecondary" align="center">
                {t('family.manageBody')}
              </AppText>
            </View>
          </Card>
        ) : null}

        <Button
          label={t('family.add')}
          icon="person-add-outline"
          size="large"
          onPress={() => router.push('/family/add')}
          accessibilityHint={t('family.addHint')}
        />

        <AppText variant="caption" color="textMuted" align="center">
          {t('family.separationNote')}
        </AppText>
      </View>
    </Screen>
  );
}

function MemberCard({
  member,
  isActive,
  medicineCount,
  conditionCount,
  onPress,
}: {
  member: FamilyMember;
  isActive: boolean;
  medicineCount: number;
  conditionCount: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useT();
  const age = ageOf(member);

  const detail = [
    member.isSelf ? t('common.me') : relationshipLabelT(t, member),
    age !== null ? t('common.years', { age }) : null,
    member.gender && member.gender !== 'UNSPECIFIED' ? genderLabel(t, member.gender) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const summary = [
    tCount(t, 'common.medicinesCount', medicineCount),
    tCount(t, 'common.conditionsCount', conditionCount),
  ].join(' · ');

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${member.name}, ${detail}. ${summary}`}
      accessibilityHint={t('family.opensProfile')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <MemberAvatar member={member} size={56} />
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText variant="subheading" numberOfLines={1}>
            {member.name}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {detail}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {summary}
          </AppText>
          {isActive ? <Badge label={t('family.managingNow')} tone="info" icon="checkmark-circle" /> : null}
        </View>
        <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
