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
import { ageOf, GENDER_LABELS, relationshipLabel, type FamilyMember } from '@/domain/familyMember';
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
          <AppText variant="title">Family</AppText>
          <AppText variant="body" color="textSecondary">
            Manage everyone’s medicines and health information from one account. No separate
            logins needed.
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
                Manage your family
              </AppText>
              <AppText variant="body" color="textSecondary" align="center">
                Add family members to keep everyone’s medicines and health information organised
                in one place — a parent, a child, a grandparent.
              </AppText>
            </View>
          </Card>
        ) : null}

        <Button
          label="Add family member"
          icon="person-add-outline"
          size="large"
          onPress={() => router.push('/family/add')}
          accessibilityHint="Opens a short form to add a person"
        />

        <AppText variant="caption" color="textMuted" align="center">
          Each person’s medicines and conditions are kept completely separate. Every screen shows
          whose information you are looking at.
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
  const age = ageOf(member);

  const detail = [
    member.isSelf ? 'Me' : relationshipLabel(member),
    age !== null ? `${age} years` : null,
    member.gender && member.gender !== 'UNSPECIFIED' ? GENDER_LABELS[member.gender] : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const summary = [
    `${medicineCount} ${medicineCount === 1 ? 'medicine' : 'medicines'}`,
    `${conditionCount} ${conditionCount === 1 ? 'condition' : 'conditions'}`,
  ].join(' · ');

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${member.name}, ${detail}. ${summary}`}
      accessibilityHint="Opens their profile">
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
          {isActive ? <Badge label="Managing now" tone="info" icon="checkmark-circle" /> : null}
        </View>
        <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
