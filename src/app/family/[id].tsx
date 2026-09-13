/**
 * One family member's dashboard: their medicines, expiry warnings, health
 * conditions and profile actions.
 *
 * Every action that leads to a medicine screen first makes this person the
 * active member, so the screen that opens is unambiguously theirs — the
 * banner on that screen then says so.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { MemberAvatar } from '@/components/family/MemberAvatar';
import { MedicationCard } from '@/components/medication/MedicationCard';
import { AppText, Badge, Button, Card, InlineMessage, Screen, TextLink } from '@/components/ui';
import { expiryStatus } from '@/domain/expiry';
import {
  ageOf,
  bloodTypeLabel,
  formatHeight,
  formatWeight,
  GENDER_LABELS,
  possessive,
  relationshipLabel,
} from '@/domain/familyMember';
import { conditionDisplayName } from '@/domain/healthCondition';
import { confirmAction } from '@/lib/confirm';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import {
  forMember,
  memberById,
  selectActiveMemberId,
  selectMembers,
  useFamilyStore,
} from '@/stores/useFamilyStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import {
  activeMedications,
  selectMedications,
  useMedicationStore,
} from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

const PREVIEW_LIMIT = 3;

export default function FamilyMemberScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore(selectUser);

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const setActiveMember = useFamilyStore((state) => state.setActiveMember);
  const removeMember = useFamilyStore((state) => state.removeMember);
  const isSaving = useFamilyStore((state) => state.isSaving);
  const error = useFamilyStore((state) => state.error);
  const reloadMedications = useMedicationStore((state) => state.load);
  const reloadConditions = useHealthConditionStore((state) => state.load);

  const allMedications = useMedicationStore(selectMedications);
  const allConditions = useHealthConditionStore(selectConditions);

  const member = useMemo(() => memberById(members, id), [members, id]);
  const medications = useMemo(
    () => activeMedications(forMember(allMedications, member?.id ?? null)),
    [allMedications, member],
  );
  const conditions = useMemo(
    () => forMember(allConditions, member?.id ?? null),
    [allConditions, member],
  );
  const attention = useMemo(
    () => medications.filter((m) => expiryStatus(m.expirationDate)?.state !== undefined && expiryStatus(m.expirationDate)?.state !== 'OK'),
    [medications],
  );
  const recent = useMemo(
    () => medications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, PREVIEW_LIMIT),
    [medications],
  );

  if (!user || !member) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title="Family member not found"
            message="This profile may have been removed."
          />
          <Button label="Back to Family" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const isActive = member.id === activeMemberId;
  const age = ageOf(member);

  /** Make this person active, then go somewhere that shows their data. */
  const manageThen = async (go: () => void) => {
    await setActiveMember(user.id, member.id);
    go();
  };

  const handleRemove = async () => {
    const medicineCount = medications.length;
    const conditionCount = conditions.length;
    const parts = [
      medicineCount > 0 ? `${medicineCount} ${medicineCount === 1 ? 'medicine' : 'medicines'}` : null,
      conditionCount > 0
        ? `${conditionCount} ${conditionCount === 1 ? 'health condition' : 'health conditions'}`
        : null,
    ].filter(Boolean);

    const confirmed = await confirmAction({
      title: `Remove ${member.name}?`,
      message:
        parts.length > 0
          ? `This also deletes their ${parts.join(' and ')}. This cannot be undone.`
          : 'Nothing has been recorded for them yet. This cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;

    const removed = await removeMember(user.id, member.id);
    if (removed) {
      void reloadMedications(user.id);
      void reloadConditions(user.id);
      router.back();
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        {/* ---------- Header ---------- */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}>
          <MemberAvatar member={member} size={72} />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText variant="title">{member.name}</AppText>
            <AppText variant="body" color="textSecondary">
              {member.isSelf ? 'Me' : relationshipLabel(member)}
              {age !== null ? ` · ${age} years old` : ''}
            </AppText>
            {isActive ? <Badge label="Managing now" tone="info" icon="checkmark-circle" /> : null}
          </View>
        </View>

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        {/* ---------- Health profile ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{possessive(member, 'health profile')}</AppText>
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg }}>
                <ProfileFact label="Age" value={age !== null ? `${age} years` : null} />
                <ProfileFact label="Gender" value={member.gender ? GENDER_LABELS[member.gender] : null} />
                <ProfileFact label="Height" value={formatHeight(member.heightCm)} />
                <ProfileFact label="Weight" value={formatWeight(member.weightKg)} />
                <ProfileFact label="Blood type" value={member.bloodType ? bloodTypeLabel(member.bloodType) : null} />
              </View>
              <AppText variant="caption" color="textMuted">
                Shared with the assistant as context only. MediMind never works out a dose or
                decides whether a medicine is suitable from these.
              </AppText>
            </View>
          </Card>
        </View>

        {/* ---------- Overview ---------- */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatTile icon="medkit-outline" value={medications.length} label="Medicines" />
          <StatTile
            icon="time-outline"
            value={attention.length}
            label="Expired or expiring"
            tone={attention.length > 0 ? 'warning' : 'normal'}
          />
          <StatTile icon="heart-outline" value={conditions.length} label="Conditions" />
        </View>

        {/* ---------- Medicines ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{possessive(member, 'medicines')}</AppText>

          {recent.length === 0 ? (
            <Card>
              <AppText variant="body" color="textSecondary" align="center">
                No medicines recorded for {member.isSelf ? 'you' : member.name} yet.
              </AppText>
            </Card>
          ) : (
            recent.map((medication) => (
              <MedicationCard
                key={medication.id}
                medication={medication}
                onPress={() =>
                  void manageThen(() =>
                    router.push({ pathname: '/medication/[id]', params: { id: medication.id } }),
                  )
                }
              />
            ))
          )}

          {medications.length > recent.length ? (
            <TextLink
              label={`See all ${medications.length} medicines`}
              onPress={() => void manageThen(() => router.push('/medications'))}
            />
          ) : null}

          <Button
            label={`Add medicine for ${member.isSelf ? 'me' : member.name}`}
            icon="add"
            onPress={() =>
              void manageThen(() =>
                router.push({ pathname: '/medication/add', params: { memberId: member.id } }),
              )
            }
          />
        </View>

        {/* ---------- Health conditions ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{possessive(member, 'health conditions')}</AppText>
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              {conditions.length === 0 ? (
                <AppText variant="body" color="textSecondary">
                  None recorded yet.
                </AppText>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {conditions.map((condition) => (
                    <Badge
                      key={condition.id}
                      label={
                        condition.reading
                          ? `${conditionDisplayName(condition)} · ${condition.reading}`
                          : conditionDisplayName(condition)
                      }
                      tone="info"
                      icon="heart-outline"
                    />
                  ))}
                </View>
              )}
              <Button
                label="Manage health conditions"
                icon="heart-outline"
                variant="secondary"
                onPress={() =>
                  void manageThen(() =>
                    router.push({ pathname: '/health/conditions', params: { memberId: member.id } }),
                  )
                }
              />
            </View>
          </Card>
        </View>

        {/* ---------- Schedule (Milestone 5) ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{possessive(member, 'schedule')}</AppText>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Ionicons name="calendar-outline" size={24} color={theme.colors.textMuted} />
              <AppText variant="body" color="textSecondary" style={{ flex: 1 }}>
                Reminders and dose tracking arrive in Milestone 5, per person.
              </AppText>
              <Badge label="Milestone 5" tone="neutral" />
            </View>
          </Card>
        </View>

        {/* ---------- Profile actions ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          {!isActive ? (
            <Button
              label={`Switch to managing ${member.isSelf ? 'my' : `${member.name}’s`} medicines`}
              icon="swap-horizontal"
              variant="secondary"
              onPress={() => void setActiveMember(user.id, member.id)}
            />
          ) : null}
          <Button
            label="Edit profile"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: '/family/edit/[id]', params: { id: member.id } })}
          />
          {member.isSelf ? null : (
            <Button
              label="Remove family member"
              icon="trash-outline"
              variant="danger"
              onPress={() => void handleRemove()}
              loading={isSaving}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

function ProfileFact({ label, value }: { label: string; value: string | null }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xxs, minWidth: 96 }}>
      <AppText variant="label" color="textMuted">
        {label.toUpperCase()}
      </AppText>
      <AppText variant="body" color={value ? 'text' : 'textMuted'} style={value ? undefined : { fontStyle: 'italic' }}>
        {value ?? 'Not recorded'}
      </AppText>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
  tone = 'normal',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tone?: 'normal' | 'warning';
}) {
  const theme = useTheme();
  const color = tone === 'warning' ? theme.colors.warningText : theme.colors.primary;

  return (
    <Card style={{ flex: 1 }} padded={false}>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}>
        <Ionicons name={icon} size={20} color={color} />
        <AppText variant="title" style={{ color }}>
          {value}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
      </View>
    </Card>
  );
}
