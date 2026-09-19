/**
 * One dose in the Schedule tab: time, medicine, dose wording, status, and
 * the Taken / Skip actions when they make sense.
 *
 * Wording rules (Phase 12): a missed dose is *recorded*, never chased. The
 * row never says "take it now"; the only guidance is to follow the label and
 * never double up, which lives on the screen, not on each row.
 */

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText, Badge, Button, Card, type BadgeTone } from '@/components/ui';
import { scheduledDate, type Dose, type DoseStatus } from '@/domain/reminder';
import { useT } from '@/i18n';
import { doseStatusLabel } from '@/i18n/labels';
import { formatClockTime } from '@/lib/datetime';
import { useTheme } from '@/theme/ThemeContext';

const TONES: Record<DoseStatus, BadgeTone> = {
  UPCOMING: 'info',
  TAKEN: 'success',
  MISSED: 'warning',
  SKIPPED: 'neutral',
};

const ICONS: Record<DoseStatus, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  UPCOMING: 'time-outline',
  TAKEN: 'checkmark-circle',
  MISSED: 'alert-circle-outline',
  SKIPPED: 'remove-circle-outline',
};

export type DoseRowProps = {
  dose: Dose;
  medicationName: string;
  doseLabel: string | null;
  /** Show the Taken / Skip buttons (today's doses only). */
  canAct: boolean;
  isSaving: boolean;
  onMark: (status: DoseStatus) => void;
};

export function DoseRow({ dose, medicationName, doseLabel, canAct, isSaving, onMark }: DoseRowProps) {
  const theme = useTheme();
  const { t } = useT();
  const time = formatClockTime(scheduledDate(dose.scheduledAt));
  const done = dose.status === 'TAKEN' || dose.status === 'SKIPPED';

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ minWidth: 76 }}>
            <AppText variant="subheading">{time}</AppText>
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="subheading" numberOfLines={2}>
              {medicationName}
            </AppText>
            {doseLabel ? (
              <AppText variant="body" color="textSecondary">
                {doseLabel}
              </AppText>
            ) : null}
          </View>
          <Badge label={doseStatusLabel(t, dose.status)} tone={TONES[dose.status]} icon={ICONS[dose.status]} />
        </View>

        {canAct ? (
          done ? (
            <Button
              label={t('common.undo')}
              icon="arrow-undo-outline"
              variant="ghost"
              fullWidth={false}
              onPress={() => onMark('UPCOMING')}
              disabled={isSaving}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Button
                label={t('dose.taken')}
                icon="checkmark"
                onPress={() => onMark('TAKEN')}
                disabled={isSaving}
                style={{ flex: 1 }}
              />
              <Button
                label={t('dose.skip')}
                icon="remove-circle-outline"
                variant="secondary"
                onPress={() => onMark('SKIPPED')}
                disabled={isSaving}
                style={{ flex: 1 }}
              />
            </View>
          )
        ) : null}

        {dose.status === 'MISSED' && canAct ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs }}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} style={{ marginTop: 2 }} />
            <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('dose.missedNote')}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
