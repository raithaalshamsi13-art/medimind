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
import { Alert, View } from 'react-native';

import { AppText, Badge, Button, Card, InlineMessage, Screen } from '@/components/ui';
import {
  SAFETY_STATUS_LABELS,
  UNKNOWN_FIELD_TEXT,
  type Medication,
} from '@/domain/medication';
import { formatIsoDate } from '@/lib/datetime';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

export default function MedicationDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const user = useAuthStore(selectUser);
  const medication = useMedicationStore(
    (state) => state.medications.find((item) => item.id === id) ?? null,
  );
  const removeMedication = useMedicationStore((state) => state.removeMedication);
  const isSaving = useMedicationStore((state) => state.isSaving);

  const confirmDelete = () => {
    if (!user || !medication) return;

    Alert.alert(
      `Delete ${medication.name}?`,
      'This removes the medicine and any reminders you have set for it. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const removed = await removeMedication(user.id, medication.id);
            if (removed) router.back();
          },
        },
      ],
    );
  };

  if (!medication) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title="Medicine not found"
            message="This medicine may have been deleted. Go back to your list to see what is saved."
          />
          <Button label="Back to my medicines" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        {/* ---------- Title ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{medication.name}</AppText>

          {/* Once Milestone 4 evaluates safety this becomes the headline
              status. Until then it stays hidden rather than showing
              "Not checked yet" on every medicine. */}
          {medication.safetyStatus === 'UNKNOWN' ? null : (
            <Badge label={SAFETY_STATUS_LABELS[medication.safetyStatus]} tone="neutral" />
          )}

          <Badge
            label={medication.source === 'SCAN' ? 'Added by scanning' : 'Added by hand'}
            tone="neutral"
            icon={medication.source === 'SCAN' ? 'camera-outline' : 'create-outline'}
          />
        </View>

        {/* ---------- Fields ---------- */}
        <Card>
          <View style={{ gap: theme.spacing.lg }}>
            <DetailRow label="Dosage" value={medication.dosage} />
            <DetailRow label="How often" value={medication.frequency} />
            <DetailRow
              label="Expiry date"
              value={medication.expirationDate ? formatIsoDate(medication.expirationDate) : null}
            />
            <DetailRow label="Instructions" value={medication.instructions} />
            <DetailRow label="Notes" value={medication.notes} />
          </View>
        </Card>

        {/* ---------- Actions ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Edit medicine"
            icon="create-outline"
            onPress={() =>
              router.push({ pathname: '/medication/edit/[id]', params: { id: medication.id } })
            }
          />
          <Button
            label="Ask about this medicine"
            icon="chatbubble-ellipses-outline"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/assistant', params: { medicationId: medication.id } })
            }
            accessibilityHint="Opens the assistant with questions about this medicine"
          />
          <Button
            label="Delete medicine"
            icon="trash-outline"
            variant="danger"
            onPress={confirmDelete}
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
 * the project's rule that MediMind never invents medical information.
 */
function DetailRow({ label, value }: { label: string; value: string | null }) {
  const theme = useTheme();
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
            {UNKNOWN_FIELD_TEXT}
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

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="caption" color="textMuted">
        Added {formatIsoDate(medication.createdAt.slice(0, 10))}
      </AppText>
      <AppText variant="caption" color="textMuted">
        Last updated {formatIsoDate(medication.updatedAt.slice(0, 10))}
      </AppText>
    </View>
  );
}
