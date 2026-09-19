/**
 * Medicine details.
 *
 * The important detail here is how unknown values are rendered. A field that
 * was never determined shows "Could not be determined" in muted text — it is
 * never left blank and never filled with a plausible-looking guess. Blank would
 * read as "nothing to say"; a guess would be dangerous.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, View } from 'react-native';

import { medicationIcon } from '@/components/medication/formIcons';
import { AppText, Badge, Button, Card, Collapsible, InlineMessage, Screen, type BadgeTone } from '@/components/ui';
import { expiryStatus, type ExpiryState } from '@/domain/expiry';
import type { Medication, SafetyStatus } from '@/domain/medication';
import { evaluateSafety } from '@/domain/safety';
import { useT } from '@/i18n';
import {
  conditionNameT,
  describeDaysT,
  describeTimesT,
  expiryLabelT,
  frequencyDisplayT,
  kindLabel,
  medicationFormLabel,
  safetyStatusLabel,
} from '@/i18n/labels';
import { confirmAction } from '@/lib/confirm';
import { formatIsoDate } from '@/lib/datetime';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { memberById, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { reminderForMedication, selectReminders, useReminderStore } from '@/stores/useReminderStore';
import { useTheme } from '@/theme/ThemeContext';

const EXPIRY_TONES: Record<ExpiryState, BadgeTone> = {
  EXPIRED: 'danger',
  EXPIRING_SOON: 'warning',
  OK: 'success',
};

const SAFETY_TONES: Record<SafetyStatus, BadgeTone> = {
  SAFE: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'danger',
  NEEDS_REVIEW: 'warning',
  UNKNOWN: 'neutral',
};

const SAFETY_ICONS: Record<SafetyStatus, keyof typeof Ionicons.glyphMap> = {
  SAFE: 'shield-checkmark-outline',
  EXPIRING_SOON: 'time-outline',
  EXPIRED: 'alert-circle',
  NEEDS_REVIEW: 'help-circle-outline',
  UNKNOWN: 'help-circle-outline',
};

export default function MedicationDetailScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const user = useAuthStore(selectUser);
  const medication = useMedicationStore(
    (state) => state.medications.find((item) => item.id === id) ?? null,
  );
  const removeMedication = useMedicationStore((state) => state.removeMedication);
  const isSaving = useMedicationStore((state) => state.isSaving);
  const conditions = useHealthConditionStore(selectConditions);
  const reminders = useReminderStore(selectReminders);
  const reminder = useMemo(
    () => (medication ? reminderForMedication(reminders, medication.id) : null),
    [reminders, medication],
  );
  const cancelForMedication = useReminderStore((state) => state.cancelForMedication);
  const reloadReminders = useReminderStore((state) => state.load);
  const members = useFamilyStore(selectMembers);
  const owner = useMemo(() => memberById(members, medication?.memberId), [members, medication]);

  const linkedConditions = useMemo(
    () =>
      medication
        ? conditions.filter((condition) => medication.conditionIds.includes(condition.id))
        : [],
    [conditions, medication],
  );

  const confirmDelete = async () => {
    if (!user || !medication) return;

    // confirmAction works in the browser too; Alert.alert silently does not.
    const confirmed = await confirmAction({
      title: t('detail.deleteTitle', { name: medication.name }),
      message: t('detail.deleteBody'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!confirmed) return;

    // The database cascades the reminder and doses; the OS notifications
    // must be cancelled by hand before the ids disappear with the row.
    await cancelForMedication(user.id, medication.id);
    const removed = await removeMedication(user.id, medication.id);
    if (removed) {
      void reloadReminders(user.id);
      router.back();
    }
  };

  if (!medication) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title={t('detail.notFoundTitle')}
            message={t('detail.notFoundBody')}
          />
          <Button label={t('detail.backToList')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const expiry = expiryStatus(medication.expirationDate);
  // Evaluated live so the reasons always match today's date, even if the
  // stored status was written on an earlier day.
  const safety = evaluateSafety(medication);

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        {/* ---------- Title ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={medicationIcon(medication.form)} size={26} color={theme.colors.primary} />
            </View>
            <AppText variant="title" style={{ flex: 1 }}>
              {medication.name}
            </AppText>
          </View>


          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {owner ? (
              <Badge
                label={owner.isSelf ? t('detail.myMedicine') : t('detail.personsMedicine', { name: owner.name })}
                tone="info"
                icon="people-outline"
              />
            ) : null}
            <Badge
              label={medication.source === 'SCAN' ? t('detail.addedByScanning') : t('detail.addedByHand')}
              tone="neutral"
              icon={medication.source === 'SCAN' ? 'camera-outline' : 'create-outline'}
            />
            {expiry && expiry.state !== 'OK' ? (
              <Badge
                label={expiryLabelT(t, expiry)}
                tone={EXPIRY_TONES[expiry.state]}
                icon={expiry.state === 'EXPIRED' ? 'alert-circle' : 'time-outline'}
              />
            ) : null}
          </View>
        </View>

        {expiry?.state === 'EXPIRED' ? (
          <InlineMessage
            tone="danger"
            title={t('detail.expiredTitle')}
            message={t('detail.expiredBody')}
          />
        ) : null}

        {/* ---------- Safety check (CHECK) ---------- */}
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="label" color="textMuted">
              {t('detail.safetyTitle')}
            </AppText>
            <Badge
              label={safetyStatusLabel(t, safety.status)}
              tone={SAFETY_TONES[safety.status]}
              icon={SAFETY_ICONS[safety.status]}
            />
            {(safety.reasons.length > 0 ? safety.reasons : (['OK'] as const)).map((reason) => (
              <View key={reason} style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
                <Ionicons
                  name={reason === 'OK' ? 'checkmark-circle-outline' : 'ellipse'}
                  size={reason === 'OK' ? 18 : 8}
                  color={theme.colors.textSecondary}
                  style={reason === 'OK' ? undefined : { marginTop: 8 }}
                />
                <AppText variant="body" color="textSecondary" style={{ flex: 1 }}>
                  {t(`safetyReason.${reason}`)}
                </AppText>
              </View>
            ))}
            <AppText variant="caption" color="textMuted">
              {t('detail.safetyNote')}
            </AppText>
          </View>
        </Card>

        {/* ---------- Scanned label ---------- */}
        {medication.source === 'SCAN' && (medication.imageUri || medication.labelText) ? (
          <Collapsible title={t('detail.showLabel')} icon="camera-outline">
            <View style={{ gap: theme.spacing.md }}>
              {medication.imageUri ? (
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('detail.labelPhoto').toUpperCase()}
                  </AppText>
                  <Image
                    source={{ uri: medication.imageUri }}
                    accessibilityLabel={t('detail.labelPhoto')}
                    resizeMode="contain"
                    style={{
                      width: '100%',
                      height: 240,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surfaceAlt,
                    }}
                  />
                </View>
              ) : null}
              {medication.labelText ? (
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('detail.labelText')}
                  </AppText>
                  <AppText variant="body" selectable style={{ fontFamily: 'monospace', lineHeight: 24 }}>
                    {medication.labelText}
                  </AppText>
                </View>
              ) : null}
            </View>
          </Collapsible>
        ) : null}

        {/* ---------- Fields ---------- */}
        <Card>
          <View style={{ gap: theme.spacing.lg }}>
            <DetailRow
              label={t('detail.type')}
              value={medication.kind ? kindLabel(t, medication.kind) : null}
              emptyText={t('common.notChosen')}
            />
            <DetailRow
              label={t('detail.form')}
              value={medication.form ? medicationFormLabel(t, medication.form) : null}
              emptyText={t('common.notChosen')}
            />
            <DetailRow label={t('detail.dosage')} value={medication.dosage} />
            <DetailRow label={t('detail.howOften')} value={frequencyDisplayT(t, medication.frequency)} />
            <DetailRow
              label={t('detail.expiryDate')}
              value={medication.expirationDate ? formatIsoDate(medication.expirationDate) : null}
            />
            <DetailRow label={t('detail.instructions')} value={medication.instructions} />
            <DetailRow label={t('detail.notes')} value={medication.notes} emptyText={t('detail.noNotes')} />
          </View>
        </Card>

        {/* ---------- Health conditions ---------- */}
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="label" color="textMuted">
              {t('detail.relatedConditions')}
            </AppText>
            {linkedConditions.length === 0 ? (
              <AppText variant="body" color="textMuted" style={{ fontStyle: 'italic' }}>
                {t('detail.noneLinked')}
              </AppText>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {linkedConditions.map((condition) => (
                  <Badge
                    key={condition.id}
                    label={
                      condition.reading
                        ? `${conditionNameT(t, condition)} · ${condition.reading}`
                        : conditionNameT(t, condition)
                    }
                    tone="info"
                    icon="heart-outline"
                  />
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* ---------- Reminder ---------- */}
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Ionicons
                name={reminder?.enabled ? 'notifications' : 'notifications-outline'}
                size={24}
                color={reminder?.enabled ? theme.colors.primary : theme.colors.textMuted}
              />
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <AppText variant="label" color="textMuted">
                  {t('detail.reminder')}
                </AppText>
                {reminder ? (
                  <>
                    <AppText variant="bodyLarge">
                      {describeTimesT(t, reminder.times)}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {describeDaysT(t, reminder)}
                      {reminder.doseLabel ? ` · ${reminder.doseLabel}` : ''}
                      {reminder.enabled ? '' : ` · ${t('detail.paused')}`}
                    </AppText>
                  </>
                ) : expiry?.state === 'EXPIRED' ? (
                  <AppText variant="body" color="textMuted" style={{ fontStyle: 'italic' }}>
                    {t('detail.reminderExpired')}
                  </AppText>
                ) : (
                  <AppText variant="body" color="textMuted" style={{ fontStyle: 'italic' }}>
                    {t('detail.noReminder')}
                  </AppText>
                )}
              </View>
            </View>
            {expiry?.state === 'EXPIRED' && !reminder ? null : (
              <Button
                label={reminder ? t('detail.editReminder') : t('detail.setReminder')}
                icon={reminder ? 'create-outline' : 'alarm-outline'}
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/reminder/[medicationId]', params: { medicationId: medication.id } })
                }
              />
            )}
          </View>
        </Card>

        {/* ---------- Actions ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={t('detail.editMedicine')}
            icon="create-outline"
            onPress={() =>
              router.push({ pathname: '/medication/edit/[id]', params: { id: medication.id } })
            }
          />
          <Button
            label={t('detail.askAbout')}
            icon="chatbubble-ellipses-outline"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/assistant', params: { medicationId: medication.id } })
            }
            accessibilityHint={t('detail.askAboutHint')}
          />
          <Button
            label={t('detail.deleteMedicine')}
            icon="trash-outline"
            variant="danger"
            onPress={() => void confirmDelete()}
            loading={isSaving}
          />
        </View>

        <MedicationMeta medication={medication} />
      </View>
    </Screen>
  );
}

/**
 * A single label/value pair.
 *
 * `null` is shown explicitly as "Could not be determined" — the visible half of
 * the project's rule that MediMind never invents medical information. Fields
 * that are a *choice* rather than a label reading pass their own `emptyText`.
 */
function DetailRow({
  label,
  value,
  emptyText,
}: {
  label: string;
  value: string | null;
  emptyText?: string;
}) {
  const theme = useTheme();
  const { t } = useT();
  const fallback = emptyText ?? t('common.couldNotBeDetermined');
  const isUnknown = value === null || value.length === 0;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label" color="textMuted">
        {label.toUpperCase()}
      </AppText>

      {isUnknown ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="help-circle-outline" size={18} color={theme.colors.textMuted} />
          <AppText variant="body" color="textMuted" style={{ fontStyle: 'italic' }}>
            {fallback}
          </AppText>
        </View>
      ) : (
        <AppText variant="bodyLarge">{value}</AppText>
      )}
    </View>
  );
}

function MedicationMeta({ medication }: { medication: Medication }) {
  const theme = useTheme();
  const { t } = useT();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="caption" color="textMuted">
        {t('detail.added', { date: formatIsoDate(medication.createdAt.slice(0, 10)) })}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {t('detail.lastUpdated', { date: formatIsoDate(medication.updatedAt.slice(0, 10)) })}
      </AppText>
    </View>
  );
}
