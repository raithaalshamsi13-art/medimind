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
import { DOSE_STATUS_LABELS, scheduledDate, type Dose, type DoseStatus } from '@/domain/reminder';
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
          <Badge label={DOSE_STATUS_LABELS[dose.status]} tone={TONES[dose.status]} icon={ICONS[dose.status]} />
        </View>

        {canAct ? (
          done ? (
            <Button
              label="Undo"
              icon="arrow-undo-outline"
              variant="ghost"
              fullWidth={false}
              onPress={() => onMark('UPCOMING')}
              disabled={isSaving}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Button
                label="Taken"
                icon="checkmark"
                onPress={() => onMark('TAKEN')}
                disabled={isSaving}
                style={{ flex: 1 }}
              />
              <Button
                label="Skip"
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
              If you did take it, mark it Taken. Otherwise follow the label — do not take a double dose.
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
