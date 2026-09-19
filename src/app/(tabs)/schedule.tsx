/**
 * Schedule and history — the TRACK part of the workflow.
 *
 * Top: the family member being managed and (on the phone) the notification
 * permission state. Then TODAY: every dose due today for that member, in
 * time order, with Taken / Skip. Then HISTORY: the last seven days, grouped
 * by day, with a "2 of 3 taken" line each. Deliberately no charts — the
 * brief asks for a simple record, and that is what a person checks.
 *
 * Doses are materialised and swept (missed) every time the tab is focused,
 * so the list is right even if the app was closed for a few days.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { MemberSwitcher } from '@/components/family/MemberSwitcher';
import { DoseRow } from '@/components/schedule/DoseRow';
import { AppText, Button, Card, InlineMessage, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { doseStatusLabel, formatTime12, possessiveT, tCount } from '@/i18n/labels';
import { localDateKey, type Dose, type DoseStatus } from '@/domain/reminder';
import { formatIsoDate } from '@/lib/datetime';
import { getNotificationService, type NotificationPermission } from '@/services/notifications';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { dosesByDay, dosesOn, selectDoses, useDoseStore } from '@/stores/useDoseStore';
import {
  memberById,
  selectActiveMemberId,
  selectMembers,
  useFamilyStore,
} from '@/stores/useFamilyStore';
import { selectMedications, useMedicationStore } from '@/stores/useMedicationStore';
import { selectReminders, useReminderStore } from '@/stores/useReminderStore';
import { useTheme } from '@/theme/ThemeContext';

export default function ScheduleScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const user = useAuthStore(selectUser);

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const setActiveMember = useFamilyStore((s) => s.setActiveMember);
  const member = useMemo(() => memberById(members, activeMemberId), [members, activeMemberId]);

  const medications = useMedicationStore(selectMedications);
  const reminders = useReminderStore(selectReminders);
  const rescheduleAll = useReminderStore((s) => s.rescheduleAll);
  const doses = useDoseStore(selectDoses);
  const loadDoses = useDoseStore((s) => s.load);
  const markDose = useDoseStore((s) => s.markDose);
  const isSaving = useDoseStore((s) => s.isSaving);
  const error = useDoseStore((s) => s.error);

  const notifications = getNotificationService();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  // Re-materialise and sweep whenever the tab comes into view.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void loadDoses(user.id, reminders);
      if (notifications.isAvailable) void notifications.getPermission().then(setPermission);
    }, [user, reminders, loadDoses, notifications]),
  );

  const todayKey = localDateKey(new Date());
  const today = useMemo(() => dosesOn(doses, todayKey, activeMemberId), [doses, todayKey, activeMemberId]);
  const history = useMemo(
    () => dosesByDay(doses, activeMemberId).filter((group) => group.day !== todayKey),
    [doses, activeMemberId, todayKey],
  );
  const memberReminders = useMemo(
    () => reminders.filter((r) => r.memberId === activeMemberId),
    [reminders, activeMemberId],
  );

  const nameOf = (medicationId: string) =>
    medications.find((m) => m.id === medicationId)?.name ?? t('common.medicine');
  const labelOf = (reminderId: string) => reminders.find((r) => r.id === reminderId)?.doseLabel ?? null;

  const handleMark = async (dose: Dose, status: DoseStatus) => {
    if (!user) return;
    await markDose(user.id, dose.id, status);
  };

  const enableNotifications = async () => {
    if (!user) return;
    const result = await notifications.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      await rescheduleAll(user.id, new Map(medications.map((m) => [m.id, m.name])));
    }
  };

  const takenToday = today.filter((d) => d.status === 'TAKEN').length;

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">{member ? possessiveT(t, member, 'schedule') : t('tabs.schedule')}</AppText>
          <AppText variant="body" color="textSecondary">
            {today.length === 0
              ? t('schedule.noDosesToday')
              : t('schedule.takenOfToday', {
                  taken: takenToday,
                  total: today.length,
                  doses: tCount(t, 'common.dosesCount', today.length).replace(/^\d+\s*/, ''),
                })}
          </AppText>
        </View>

        {members.length > 1 && user ? (
          <MemberSwitcher
            members={members}
            activeMemberId={activeMemberId}
            onSelect={(id) => void setActiveMember(user.id, id)}
          />
        ) : null}
        {member && !member.isSelf ? (
          <MemberContextBanner member={member} prefix={t('schedule.showingFor')} />
        ) : null}

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        {/* ---------- Notifications ---------- */}
        {!notifications.isAvailable ? (
          <InlineMessage
            tone="info"
            message={t('schedule.webNotice')}
          />
        ) : permission === 'undetermined' ? (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
                <AppText variant="subheading" style={{ flex: 1 }}>
                  {t('schedule.getReminded')}
                </AppText>
              </View>
              <AppText variant="body" color="textSecondary">
                {t('schedule.getRemindedBody')}
              </AppText>
              <Button label={t('schedule.turnOn')} icon="notifications" onPress={() => void enableNotifications()} />
            </View>
          </Card>
        ) : permission === 'denied' ? (
          <InlineMessage
            tone="warning"
            title={t('schedule.offTitle')}
            message={t('schedule.offBody')}
          />
        ) : null}

        {/* ---------- Today ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('schedule.today', { date: formatIsoDate(todayKey) })}</AppText>

          {today.length === 0 ? (
            <Card>
              <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
                <Ionicons name="calendar-clear-outline" size={40} color={theme.colors.textMuted} />
                <AppText variant="subheading" align="center">
                  {memberReminders.length === 0 ? t('schedule.noRemindersYet') : t('schedule.nothingDue')}
                </AppText>
                <AppText variant="body" color="textSecondary" align="center">
                  {memberReminders.length === 0 ? t('schedule.noRemindersBody') : t('schedule.notOnToday')}
                </AppText>
                {memberReminders.length === 0 ? (
                  <Button
                    label={t('schedule.goToMedicines')}
                    icon="medkit-outline"
                    variant="secondary"
                    onPress={() => router.push('/medications')}
                  />
                ) : null}
              </View>
            </Card>
          ) : (
            today.map((dose) => (
              <DoseRow
                key={dose.id}
                dose={dose}
                medicationName={nameOf(dose.medicationId)}
                doseLabel={labelOf(dose.reminderId)}
                canAct
                isSaving={isSaving}
                onMark={(status) => void handleMark(dose, status)}
              />
            ))
          )}

          {today.length > 0 ? (
            <AppText variant="caption" color="textMuted">
              {t('schedule.markNote')}
            </AppText>
          ) : null}
        </View>

        {/* ---------- History ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('schedule.history')}</AppText>
          {history.length === 0 ? (
            <Card>
              <AppText variant="body" color="textSecondary" align="center">
                {t('schedule.historyEmpty')}
              </AppText>
            </Card>
          ) : (
            history.map((group) => <HistoryDay key={group.day} day={group.day} doses={group.doses} nameOf={nameOf} />)
          )}
        </View>
      </View>
    </Screen>
  );
}

function HistoryDay({
  day,
  doses,
  nameOf,
}: {
  day: string;
  doses: Dose[];
  nameOf: (medicationId: string) => string;
}) {
  const theme = useTheme();
  const { t } = useT();
  const taken = doses.filter((d) => d.status === 'TAKEN').length;
  const missed = doses.filter((d) => d.status === 'MISSED').length;

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="subheading">{formatIsoDate(day)}</AppText>
          <AppText variant="caption" color={missed > 0 ? 'warningText' : 'textSecondary'}>
            {t('schedule.takenOf', { taken, total: doses.length })}{missed > 0 ? t('schedule.missedN', { n: missed }) : ''}
          </AppText>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          {doses.map((dose) => (
            <HistoryLine key={dose.id} dose={dose} name={nameOf(dose.medicationId)} />
          ))}
        </View>
      </View>
    </Card>
  );
}

function HistoryLine({ dose, name }: { dose: Dose; name: string }) {
  const theme = useTheme();
  const { t } = useT();
  const icon: Record<DoseStatus, keyof typeof Ionicons.glyphMap> = {
    UPCOMING: 'time-outline',
    TAKEN: 'checkmark-circle',
    MISSED: 'alert-circle-outline',
    SKIPPED: 'remove-circle-outline',
  };
  const color: Record<DoseStatus, string> = {
    UPCOMING: theme.colors.info,
    TAKEN: theme.colors.success,
    MISSED: theme.colors.warning,
    SKIPPED: theme.colors.textMuted,
  };
  const pretty = formatTime12(t, dose.scheduledAt.slice(11, 16));

  return (
    <View
      accessible
      accessibilityLabel={`${pretty}, ${name}, ${dose.status.toLowerCase()}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Ionicons name={icon[dose.status]} size={20} color={color[dose.status]} />
      <AppText variant="body" style={{ minWidth: 76 }}>
        {pretty}
      </AppText>
      <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
        {name}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        {dose.status === 'UPCOMING' ? t('schedule.notMarked') : doseStatusLabel(t, dose.status)}
      </AppText>
    </View>
  );
}
