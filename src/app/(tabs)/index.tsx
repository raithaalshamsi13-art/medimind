/**
 * Home dashboard.
 *
 * Layout priority is deliberate: the Scan action is the largest, highest-
 * contrast element on the screen, because "scan the medicine first" is the
 * behaviour MediMind is trying to encourage.
 *
 * The medication list is genuinely empty at this milestone (there is no
 * database yet), so this screen renders its real empty state rather than mock
 * data. Milestone 3 fills the same components from SQLite.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { MedicationCard } from '@/components/medication/MedicationCard';
import { AppText, Button, Card, Screen, TextLink } from '@/components/ui';
import { useT } from '@/i18n';
import { possessiveT, tCount } from '@/i18n/labels';
import { localDateKey, scheduledDate } from '@/domain/reminder';
import { firstNameOf } from '@/domain/user';
import { formatClockTime, formatFullDate, greetingFor } from '@/lib/datetime';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { dosesOn, selectDoses, useDoseStore } from '@/stores/useDoseStore';
import {
  forMember,
  memberById,
  selectActiveMemberId,
  selectMembers,
  useFamilyStore,
} from '@/stores/useFamilyStore';
import { activeMedications, selectMedications, useMedicationStore } from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

/** How many medicines the dashboard previews before deferring to the tab. */
const DASHBOARD_PREVIEW_LIMIT = 3;

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const user = useAuthStore(selectUser);

  const allMedications = useMedicationStore(selectMedications);
  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const member = useMemo(() => memberById(members, activeMemberId), [members, activeMemberId]);

  // The dashboard shows the active family member's medicines — "Me" unless
  // the user switched to a relative. Derived here rather than in a store
  // selector, so the snapshot React sees stays stable between renders.
  const medications = useMemo(
    () => activeMedications(forMember(allMedications, activeMemberId)),
    [allMedications, activeMemberId],
  );
  const medicationCount = medications.length;
  const recent = useMemo(
    () =>
      medications
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, DASHBOARD_PREVIEW_LIMIT),
    [medications],
  );

  // Today's doses for the active member, from the dose store (TRACK).
  const doses = useDoseStore(selectDoses);
  const todayDoses = useMemo(
    () => dosesOn(doses, localDateKey(new Date()), activeMemberId),
    [doses, activeMemberId],
  );
  const takenToday = todayDoses.filter((d) => d.status === 'TAKEN').length;
  const nextDose = todayDoses.find((d) => d.status === 'UPCOMING') ?? null;
  const nextDoseLabel = nextDose
    ? `${formatClockTime(scheduledDate(nextDose.scheduledAt))} · ${
        medications.find((m) => m.id === nextDose.medicationId)?.name ?? t('common.medicine')
      }`
    : '';

  const greeting = user ? `${greetingFor()}, ${firstNameOf(user)}` : greetingFor();

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        {/* ---------- Brand header ----------
            The full logo lockup, then a hairline rule separating the brand from
            the user's own content. The rule matters: without it the wordmark
            and the greeting read as two competing headlines. */}
        <View style={{ gap: theme.spacing.base }}>
          <Logo variant="lockup" size={46} showTagline />
          {/* borderStrong, not border: a hairline in the soft token would be
              almost invisible against the pale blue background. */}
          <View style={{ height: 1, backgroundColor: theme.colors.borderStrong }} />
        </View>

        {/* ---------- Greeting ---------- */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">{greeting}</AppText>
          <AppText variant="body" color="textSecondary">
            {formatFullDate()}
          </AppText>
        </View>

        {/* ---------- Whose medicines ---------- */}
        {member && !member.isSelf ? (
          <MemberContextBanner
            member={member}
            prefix={t('home.showingMedicinesFor')}
            onChange={() => router.push('/family')}
          />
        ) : null}

        {/* ---------- Hero action: Scan ---------- */}
        <ScanHeroCard />

        {/* ---------- At-a-glance counts ---------- */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard
            icon="medkit-outline"
            value={medicationCount}
            label={tCount(t, 'home.medicineSaved', medicationCount)}
          />
          <StatCard
            icon="checkmark-done-outline"
            value={takenToday}
            label={todayDoses.length > 0 ? t('home.ofDosesTakenToday', { count: todayDoses.length }) : t('home.dosesTakenToday')}
          />
        </View>

        {/* ---------- Next dose ---------- */}
        <Card
          onPress={() => router.push('/schedule')}
          accessibilityLabel={nextDose ? `${t('home.nextDose')}: ${nextDoseLabel}` : t('home.opensSchedule')}
          accessibilityHint={t('home.opensSchedule')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="alarm-outline" size={26} color={theme.colors.primary} />
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="label" color="textMuted">
                {t('home.nextDose')}
              </AppText>
              <AppText variant="subheading">
                {nextDose
                  ? nextDoseLabel
                  : todayDoses.length > 0
                    ? t('home.allDoneToday')
                    : t('home.noRemindersYet')}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
          </View>
        </Card>

        {/* ---------- Your medicines ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{member ? possessiveT(t, member, 'medicines') : t('home.yourMedicines')}</AppText>

          {medicationCount === 0 ? (
            <Card>
              <View
                style={{
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                }}>
                <Ionicons name="calendar-clear-outline" size={40} color={theme.colors.textMuted} />
                <AppText variant="subheading" align="center">
                  {t('home.nothingSavedYet')}
                </AppText>
                <AppText variant="body" color="textSecondary" align="center">
                  {t('home.nothingSavedBody')}
                </AppText>
                <Button
                  label={t('home.addManually')}
                  icon="create-outline"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/medication/add',
                      params: member ? { memberId: member.id } : {},
                    })
                  }
                  accessibilityHint={t('home.addManuallyHint')}
                />
              </View>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {recent.map((medication) => (
                <MedicationCard
                  key={medication.id}
                  medication={medication}
                  onPress={() =>
                    router.push({ pathname: '/medication/[id]', params: { id: medication.id } })
                  }
                />
              ))}

              {medicationCount > recent.length ? (
                <TextLink
                  label={t('home.seeAll', { count: medicationCount })}
                  onPress={() => router.push('/medications')}
                />
              ) : null}

              <Button
                label={t('home.addMedicine')}
                icon="add"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/medication/add',
                    params: member ? { memberId: member.id } : {},
                  })
                }
              />
            </View>
          )}
        </View>

        {/* ---------- Disclaimer ---------- */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
            {t('disclaimer.short')}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

/**
 * The primary call to action. Filled with the brand colour and sized well above
 * the minimum touch target so it is unmistakably the main thing to press.
 */
function ScanHeroCard() {
  const theme = useTheme();
  const { t } = useT();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Pressable
        disabled
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel={t('home.scanMedicine')}
        accessibilityHint={t('home.scanHint')}
        accessibilityState={{ disabled: true }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.base,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.lg,
          minHeight: 108,
          // Communicates "not yet available" alongside the caption below —
          // never by colour alone.
          opacity: 0.75,
        }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radius.lg,
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="camera" size={34} color={theme.colors.primaryText} />
        </View>

        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText variant="heading" style={{ color: theme.colors.primaryText }}>
            {t('home.scanMedicine')}
          </AppText>
          <AppText variant="body" style={{ color: theme.colors.primaryText, opacity: 0.9 }}>
            {t('home.scanSubtitle')}
          </AppText>
        </View>

        <Ionicons name="chevron-forward" size={26} color={theme.colors.primaryText} />
      </Pressable>

      <AppText variant="caption" color="textMuted" align="center">
        {t('home.scanComing')}
      </AppText>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  const theme = useTheme();

  return (
    <Card style={{ flex: 1 }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
        <AppText variant="display">{value}</AppText>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
      </View>
    </Card>
  );
}
