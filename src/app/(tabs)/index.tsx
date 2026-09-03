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
import { MedicationCard } from '@/components/medication/MedicationCard';
import { AppText, Button, Card, Screen, TextLink } from '@/components/ui';
import { MEDICAL_DISCLAIMER_SHORT } from '@/config/constants';
import { firstNameOf } from '@/domain/user';
import { formatFullDate, greetingFor } from '@/lib/datetime';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import {
  activeMedications,
  selectMedicationCount,
  selectMedications,
  useMedicationStore,
} from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

/** How many medicines the dashboard previews before deferring to the tab. */
const DASHBOARD_PREVIEW_LIMIT = 3;

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore(selectUser);

  const medications = useMedicationStore(selectMedications);
  const medicationCount = useMedicationStore(selectMedicationCount);

  // Most recently added first — derived here rather than in a store selector,
  // so the snapshot React sees stays stable between renders.
  const recent = useMemo(
    () =>
      activeMedications(medications)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, DASHBOARD_PREVIEW_LIMIT),
    [medications],
  );

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

        {/* ---------- Hero action: Scan ---------- */}
        <ScanHeroCard />

        {/* ---------- At-a-glance counts ---------- */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard
            icon="medkit-outline"
            value={medicationCount}
            label={medicationCount === 1 ? 'Medicine saved' : 'Medicines saved'}
          />
          <StatCard icon="checkmark-done-outline" value={0} label="Doses taken today" />
        </View>

        {/* ---------- Your medicines ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">Your medicines</AppText>

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
                  Nothing saved yet
                </AppText>
                <AppText variant="body" color="textSecondary" align="center">
                  Add a medicine by hand to get started. Once scanning is available, MediMind will
                  read the label for you and suggest a reminder to confirm.
                </AppText>
                <Button
                  label="Add medicine manually"
                  icon="create-outline"
                  variant="secondary"
                  onPress={() => router.push('/medication/add')}
                  accessibilityHint="Opens a form to type in a medicine"
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
                  label={`See all ${medicationCount} medicines`}
                  onPress={() => router.push('/medications')}
                />
              ) : null}

              <Button
                label="Add medicine"
                icon="add"
                variant="secondary"
                onPress={() => router.push('/medication/add')}
              />
            </View>
          )}
        </View>

        {/* ---------- Disclaimer ---------- */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
            {MEDICAL_DISCLAIMER_SHORT}
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

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Pressable
        disabled
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel="Scan medicine"
        accessibilityHint="Camera label scanning is added in Milestone 4"
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
            Scan Medicine
          </AppText>
          <AppText variant="body" style={{ color: theme.colors.primaryText, opacity: 0.9 }}>
            Read the label and check it is safe
          </AppText>
        </View>

        <Ionicons name="chevron-forward" size={26} color={theme.colors.primaryText} />
      </Pressable>

      <AppText variant="caption" color="textMuted" align="center">
        Camera and AI label reading arrive in Milestone 4.
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
