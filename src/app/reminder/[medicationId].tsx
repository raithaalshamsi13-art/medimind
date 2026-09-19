/**
 * Set or edit the reminder for one medicine — REMIND in the workflow.
 *
 * Opened right after a medicine is saved (`?new=1`, with a "Not now" way
 * out) and from the medicine's detail screen. The times are PRE-FILLED from
 * the label's recorded frequency ("twice daily" → 8:00 AM and 8:00 PM) and
 * the dose wording from the recorded dosage; the user confirms or edits, and
 * nothing is scheduled until they press Confirm.
 *
 * An EXPIRED medicine is blocked here (Phase 7): the screen explains why and
 * offers to edit the medicine instead. If the label wording could not be
 * understood, the form starts empty rather than guessing.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import {
  AppText,
  Button,
  Card,
  ChoiceChips,
  Collapsible,
  DateField,
  FormSection,
  InlineMessage,
  MultiChoiceChips,
  Screen,
  TextField,
  TimeField,
  type ChipOption,
} from '@/components/ui';
import { formatIsoDate } from '@/lib/datetime';
import {
  reminderInputSchema,
  suggestReminder,
  WEEKDAYS,
  type Reminder,
  type ReminderFrequency,
  type ReminderInput,
  type Weekday,
} from '@/domain/reminder';
import { useT } from '@/i18n';
import { describeTimesT, frequencyDisplayT, localizeMessage, weekdayLabel } from '@/i18n/labels';
import { confirmAction } from '@/lib/confirm';
import { fieldErrorsOf } from '@/lib/validation';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { memberById, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { selectMedications, useMedicationStore } from '@/stores/useMedicationStore';
import { reminderForMedication, selectReminders, useReminderStore } from '@/stores/useReminderStore';
import { useTheme } from '@/theme/ThemeContext';

type Field = 'times' | 'doseLabel' | 'frequency' | 'days' | 'startDate' | 'endDate' | 'enabled';

type Draft = {
  times: string[];
  doseLabel: string;
  frequency: ReminderFrequency;
  days: Weekday[];
  startDate: string;
  endDate: string;
  enabled: boolean;
};


function draftFrom(existing: Reminder | null, suggestedTimes: string[], doseLabel: string | null): Draft {
  if (existing) {
    return {
      times: existing.times,
      doseLabel: existing.doseLabel ?? '',
      frequency: existing.frequency,
      days: existing.days,
      startDate: existing.startDate ?? '',
      endDate: existing.endDate ?? '',
      enabled: existing.enabled,
    };
  }
  return {
    times: suggestedTimes,
    doseLabel: doseLabel ?? '',
    frequency: 'DAILY',
    days: [],
    startDate: '',
    endDate: '',
    enabled: true,
  };
}

export default function ReminderScreen() {
  const theme = useTheme();
  const { t } = useT();
  const frequencyOptions: readonly ChipOption<ReminderFrequency>[] = [
    { value: 'DAILY', label: t('reminder.everyDay'), icon: 'repeat-outline' },
    { value: 'SPECIFIC_DAYS', label: t('reminder.certainDays'), icon: 'calendar-outline' },
  ];
  const dayOptions: readonly ChipOption<`${Weekday}`>[] = WEEKDAYS.map((day) => ({
    value: `${day}`,
    label: weekdayLabel(t, day),
  }));
  const router = useRouter();
  const { medicationId, new: isNew } = useLocalSearchParams<{ medicationId: string; new?: string }>();
  const user = useAuthStore(selectUser);

  const medications = useMedicationStore(selectMedications);
  const medication = useMemo(
    () => medications.find((m) => m.id === medicationId) ?? null,
    [medications, medicationId],
  );
  const members = useFamilyStore(selectMembers);
  const member = useMemo(() => memberById(members, medication?.memberId), [members, medication]);

  const reminders = useReminderStore(selectReminders);
  const existing = useMemo(
    () => (medicationId ? reminderForMedication(reminders, medicationId) : null),
    [reminders, medicationId],
  );
  const createReminder = useReminderStore((s) => s.createReminder);
  const updateReminder = useReminderStore((s) => s.updateReminder);
  const removeReminder = useReminderStore((s) => s.removeReminder);
  const isSaving = useReminderStore((s) => s.isSaving);
  const error = useReminderStore((s) => s.error);

  const suggestion = useMemo(() => (medication ? suggestReminder(medication) : null), [medication]);

  const [draft, setDraft] = useState<Draft>(() =>
    draftFrom(
      existing,
      suggestion?.kind === 'suggested' ? suggestion.times : [],
      suggestion && suggestion.kind !== 'blocked' ? suggestion.doseLabel : null,
    ),
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const patch = (changes: Partial<Draft>, clears: Field[] = []) => {
    setDraft((current) => ({ ...current, ...changes }));
    if (clears.length > 0) {
      setFieldErrors((current) => {
        const next = { ...current };
        for (const field of clears) delete next[field];
        return next;
      });
    }
  };

  if (!user || !medication || !member) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title={t('detail.notFoundTitle')}
            message={t('family.notFoundBody')}
          />
          <Button label={t('common.goBack')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const goToMedicine = () =>
    router.replace({ pathname: '/medication/[id]', params: { id: medication.id } });

  // ---------------------------------------------------------------------------
  // Expired: no normal reminder (Phase 7)
  // ---------------------------------------------------------------------------
  if (suggestion?.kind === 'blocked') {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.xl }}>
          <MemberContextBanner member={member} prefix={t('reminder.for')} />
          <AppText variant="title">{medication.name}</AppText>
          <InlineMessage tone="danger" title={t('reminder.expiredTitle')} message={t('reminder.expiredReason')} />
          <AppText variant="body" color="textSecondary">
            {t('reminder.recordedExpiry', { date: medication.expirationDate ? formatIsoDate(medication.expirationDate) : t('reminder.unknown') })}
          </AppText>
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label={t('reminder.editMedicine')}
              icon="create-outline"
              onPress={() =>
                router.replace({ pathname: '/medication/edit/[id]', params: { id: medication.id } })
              }
            />
            <Button label={t('reminder.backToMedicine')} variant="secondary" onPress={goToMedicine} />
          </View>
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    const parsed = reminderInputSchema.safeParse({
      ...draft,
      days: draft.days,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsOf<Field>(parsed.error));
      return;
    }
    setFieldErrors({});
    const input: ReminderInput = parsed.data;

    const saved = existing
      ? await updateReminder(user.id, existing.id, input, medication.name)
      : (await createReminder(
          user.id,
          { ...input, medicationId: medication.id, memberId: member.id },
          medication.name,
        )) !== null;
    if (saved) goToMedicine();
  };

  const handleRemove = async () => {
    if (!existing) return;
    const confirmed = await confirmAction({
      title: t('reminder.removeTitle'),
      message: t('reminder.removeBody', { name: medication.name }),
      confirmLabel: t('reminder.remove'),
      destructive: true,
    });
    if (!confirmed) return;
    const removed = await removeReminder(user.id, existing.id);
    if (removed) goToMedicine();
  };

  const addTime = () => {
    // Next free hour after the last time, or 8:00 AM for an empty list.
    const last = draft.times[draft.times.length - 1];
    const nextHour = last ? (Number(last.split(':')[0]) + 4) % 24 : 8;
    const candidate = `${String(nextHour).padStart(2, '0')}:00`;
    patch({ times: [...draft.times, draft.times.includes(candidate) ? `${String((nextHour + 1) % 24).padStart(2, '0')}:00` : candidate] }, ['times']);
  };

  const setTime = (index: number, value: string) => {
    const times = [...draft.times];
    times[index] = value;
    patch({ times }, ['times']);
  };

  const removeTime = (index: number) => {
    patch({ times: draft.times.filter((_, i) => i !== index) }, ['times']);
  };

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.xl }}>
        <MemberContextBanner member={member} prefix={existing ? t('reminder.editingFor') : t('reminder.settingFor')} />

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">{medication.name}</AppText>
          <AppText variant="body" color="textSecondary">
            {[medication.dosage, frequencyDisplayT(t, medication.frequency)].filter(Boolean).join(' · ') || t('reminder.noDoseOrFrequency')}
          </AppText>
        </View>

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        {!existing && suggestion?.kind === 'suggested' ? (
          <InlineMessage
            tone="info"
            title={t('reminder.suggestedTitle')}
            message={t('reminder.suggestedBody', { frequency: medication.frequency ?? '', times: describeTimesT(t, suggestion.times) })}
          />
        ) : null}
        {!existing && suggestion?.kind === 'as-needed' ? (
          <InlineMessage
            tone="info"
            title={t('reminder.asNeededTitle')}
            message={t('reminder.asNeededBody')}
          />
        ) : null}
        {!existing && suggestion?.kind === 'none' ? (
          <InlineMessage
            tone="warning"
            title={t('reminder.noSuggestionTitle')}
            message={t('reminder.noSuggestionBody')}
          />
        ) : null}

        {/* ---------- Times ---------- */}
        <FormSection
          step={1}
          title={t('reminder.timesTitle')}
          description={t('reminder.timesDesc')}>
          {draft.times.map((time, index) => (
            <TimeField
              key={`${index}-${time}`}
              label={t('reminder.timeN', { n: index + 1 })}
              value={time}
              onChange={(value) => setTime(index, value)}
              onRemove={draft.times.length > 1 ? () => removeTime(index) : undefined}
            />
          ))}
          {fieldErrors.times ? (
            <AppText variant="caption" color="dangerText">
              {localizeMessage(fieldErrors.times)}
            </AppText>
          ) : null}
          {draft.times.length < 12 ? (
            <Button label={t('reminder.addTime')} icon="add" variant="secondary" onPress={addTime} />
          ) : null}
        </FormSection>

        {/* ---------- Dose wording ---------- */}
        <FormSection
          step={2}
          title={t('reminder.saysTitle')}
          description={t('reminder.saysDesc')}>
          <TextField
            label={t('reminder.dose')}
            value={draft.doseLabel}
            onChangeText={(doseLabel) => patch({ doseLabel }, ['doseLabel'])}
            placeholder={t('reminder.dosePlaceholder')}
            error={fieldErrors.doseLabel}
            helper={medication.dosage ? undefined : t('reminder.doseHelperNone')}
          />
        </FormSection>

        {/* ---------- Days ---------- */}
        <FormSection step={3} title={t('reminder.daysTitle')} description={t('reminder.daysDesc')}>
          <ChoiceChips
            options={frequencyOptions}
            value={draft.frequency}
            onChange={(frequency) => patch({ frequency: frequency ?? 'DAILY' }, ['days'])}
            accessibilityLabel={t('reminder.daysTitle')}
            allowClear={false}
          />
          {draft.frequency === 'SPECIFIC_DAYS' ? (
            <View style={{ gap: theme.spacing.sm }}>
              <MultiChoiceChips
                options={dayOptions}
                values={draft.days.map((day) => `${day}` as `${Weekday}`)}
                onChange={(values) => patch({ days: values.map((v) => Number(v) as Weekday) }, ['days'])}
                accessibilityLabel={t('reminder.certainDays')}
              />
              {fieldErrors.days ? (
                <AppText variant="caption" color="dangerText">
                  {localizeMessage(fieldErrors.days)}
                </AppText>
              ) : null}
            </View>
          ) : null}

          <Collapsible
            title={t('reminder.startEnd')}
            icon="calendar-clear-outline"
            summary={
              draft.startDate || draft.endDate
                ? `${draft.startDate ? t('reminder.from', { date: formatIsoDate(draft.startDate) }) : t('reminder.fromToday')}${draft.endDate ? t('reminder.until', { date: formatIsoDate(draft.endDate) }) : ''}`
                : undefined
            }
            defaultOpen={Boolean(draft.startDate || draft.endDate)}>
            <DateField
              label={t('reminder.startDate')}
              value={draft.startDate}
              onChange={(startDate) => patch({ startDate }, ['startDate'])}
              error={fieldErrors.startDate}
              helper={t('reminder.startHelper')}
            />
            <DateField
              label={t('reminder.endDate')}
              value={draft.endDate}
              onChange={(endDate) => patch({ endDate }, ['endDate'])}
              error={fieldErrors.endDate}
              helper={t('reminder.endHelper')}
            />
          </Collapsible>
        </FormSection>

        {existing ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <AppText variant="subheading">{t('reminder.on')}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('reminder.pauseNote')}
                </AppText>
              </View>
              <Switch
                value={draft.enabled}
                onValueChange={(enabled) => patch({ enabled })}
                accessibilityLabel={t('reminder.on')}
                trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
              />
            </View>
          </Card>
        ) : null}

        <AppText variant="caption" color="textMuted">
          {t('reminder.note')}
        </AppText>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={existing ? t('reminder.save') : t('reminder.confirm')}
            icon="checkmark"
            size="large"
            onPress={() => void handleSubmit()}
            loading={isSaving}
          />
          {isNew ? (
            <Button label={t('common.notNow')} variant="secondary" onPress={goToMedicine} disabled={isSaving} />
          ) : (
            <Button label={t('common.cancel')} variant="secondary" onPress={() => router.back()} disabled={isSaving} />
          )}
          {existing ? (
            <Button
              label={t('reminder.remove')}
              icon="trash-outline"
              variant="danger"
              onPress={() => void handleRemove()}
              disabled={isSaving}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
