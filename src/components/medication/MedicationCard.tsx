/**
 * One medicine in a list.
 *
 * The safety badge is only rendered once a medicine has actually been
 * evaluated. Until MedicationSafetyService exists (Milestone 4) every medicine
 * is `UNKNOWN`, and showing "Not checked yet" on every single row would be
 * noise that trains the user to ignore the badge — exactly the wrong habit for
 * the one component that will later say "EXPIRED".
 */

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText, Badge, Card } from '@/components/ui';
import type { Medication, SafetyStatus } from '@/domain/medication';
import { useT } from '@/i18n';
import { safetyStatusLabel } from '@/i18n/labels';
import { formatIsoDate } from '@/lib/datetime';
import { useTheme } from '@/theme/ThemeContext';

import { medicationIcon } from './formIcons';

import type { BadgeTone } from '@/components/ui';

const SAFETY_TONES: Record<SafetyStatus, BadgeTone> = {
  SAFE: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'danger',
  NEEDS_REVIEW: 'warning',
  UNKNOWN: 'neutral',
};

export type MedicationCardProps = {
  medication: Medication;
  onPress: () => void;
};

export function MedicationCard({ medication, onPress }: MedicationCardProps) {
  const theme = useTheme();
  const { t } = useT();

  // "500 mg · Twice daily", skipping whichever part is unknown.
  const subtitle = [medication.dosage, medication.frequency].filter(Boolean).join(' · ');

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={medication.name}
      accessibilityHint={t('medicines.card.hint')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={medicationIcon(medication.form)} size={22} color={theme.colors.primary} />
        </View>

        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText variant="subheading" numberOfLines={2}>
            {medication.name}
          </AppText>

          {subtitle.length > 0 ? (
            <AppText variant="body" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}

          {medication.expirationDate ? (
            <AppText variant="caption" color="textMuted">
              {t('medicines.card.expires', { date: formatIsoDate(medication.expirationDate) })}
            </AppText>
          ) : (
            <AppText variant="caption" color="textMuted">
              {t('medicines.card.noExpiry')}
            </AppText>
          )}

          {medication.safetyStatus === 'UNKNOWN' ? null : (
            <Badge
              label={safetyStatusLabel(t, medication.safetyStatus)}
              tone={SAFETY_TONES[medication.safetyStatus]}
            />
          )}
        </View>

        <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
