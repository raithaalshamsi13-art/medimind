/**
 * Settings.
 *
 * Milestone 2 ships the parts that actually work today: the profile card, the
 * two accessibility switches (which are wired all the way through the theme),
 * and logout. Everything still to come is listed but visibly inactive, rather
 * than being a switch that silently does nothing.
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Switch, View } from 'react-native';

import { isAssistantConfigured, isSupabaseConfigured } from '@/config/env';
import { Logo } from '@/components/brand/Logo';
import {
  AppText,
  Badge,
  Button,
  Card,
  InlineMessage,
  OptionGroup,
  Screen,
  type Option,
} from '@/components/ui';
import { APP_NAME, APP_TAGLINE, MEDICAL_DISCLAIMER } from '@/config/constants';
import { firstNameOf } from '@/domain/user';
import { isStoragePersistent } from '@/lib/storage';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore, type AppearancePreference } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme/ThemeContext';
import { PALETTE_LIST, type PaletteId } from '@/theme/palettes';

const APPEARANCE_OPTIONS: readonly Option<AppearancePreference>[] = [
  {
    value: 'system',
    label: 'Match my phone',
    description: 'Follow the device light or dark setting.',
    icon: 'phone-portrait-outline',
  },
  { value: 'light', label: 'Light', description: 'Always use the light theme.', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme.', icon: 'moon-outline' },
];

/** Built from the palette registry, so adding a palette needs no change here. */
const PALETTE_OPTIONS: readonly Option<PaletteId>[] = PALETTE_LIST.map((palette) => ({
  value: palette.id,
  label: palette.name,
  description: palette.description,
  swatch: palette.swatch,
}));

const UPCOMING_SETTINGS = [
  { icon: 'notifications-outline', label: 'Notifications', milestone: 'Milestone 5' },
  { icon: 'volume-high-outline', label: 'Voice alerts', milestone: 'Milestone 6' },
  { icon: 'person-outline', label: 'Edit profile', milestone: 'Milestone 6' },
  { icon: 'lock-closed-outline', label: 'Privacy', milestone: 'Milestone 6' },
] as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const user = useAuthStore(selectUser);
  const isLocalOnly = useAuthStore((state) => state.isLocalOnly);
  const signOut = useAuthStore((state) => state.signOut);

  const largeText = useSettingsStore((state) => state.largeText);
  const highContrast = useSettingsStore((state) => state.highContrast);
  const appearance = useSettingsStore((state) => state.appearance);
  const paletteId = useSettingsStore((state) => state.paletteId);
  const setSetting = useSettingsStore((state) => state.set);

  const confirmSignOut = () => {
    Alert.alert('Log out of MediMind?', 'Your saved medicines and reminders stay on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        <AppText variant="title">Settings</AppText>

        {/*
          Honest warning when the device gave us no durable storage — usually
          because the app is running in a web browser, where the native secure
          store does not exist. The app still works; the data just won't last.
        */}
        {isStoragePersistent() ? null : (
          <InlineMessage
            tone="warning"
            title="Data will not be saved"
            message="MediMind could not open secure storage here, so your account and settings will be lost when the app closes. This normally means the app is running in a web browser — open it with Expo Go on a phone for full functionality."
          />
        )}

        {/* ---------- Profile ---------- */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText variant="title" style={{ color: theme.colors.primary }}>
                {user ? firstNameOf(user).charAt(0).toUpperCase() : '?'}
              </AppText>
            </View>

            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <AppText variant="subheading">{user?.displayName ?? 'MediMind user'}</AppText>
              <AppText variant="caption" color="textSecondary">
                {user?.email ?? 'Not signed in'}
              </AppText>
              <Badge
                label={isLocalOnly ? 'Saved on this device' : 'Cloud account'}
                tone={isLocalOnly ? 'neutral' : 'success'}
                icon={isLocalOnly ? 'phone-portrait-outline' : 'cloud-done-outline'}
              />
            </View>
          </View>
        </Card>

        {/* ---------- Appearance ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">Appearance</AppText>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textMuted">
              LIGHT OR DARK
            </AppText>
            <OptionGroup
              accessibilityLabel="Light or dark appearance"
              options={APPEARANCE_OPTIONS}
              value={appearance}
              onChange={(next) => setSetting('appearance', next)}
            />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textMuted">
              COLOUR THEME
            </AppText>
            <OptionGroup
              accessibilityLabel="Colour theme"
              options={PALETTE_OPTIONS}
              value={paletteId}
              onChange={(next) => setSetting('paletteId', next)}
            />
          </View>

          <AppText variant="caption" color="textMuted">
            Every colour theme is checked to meet the WCAG AA contrast standard, so text stays
            readable whichever you pick.
          </AppText>
        </View>

        {/* ---------- Accessibility (live) ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">Accessibility</AppText>

          <Card>
            <View style={{ gap: theme.spacing.base }}>
              <ToggleRow
                icon="text-outline"
                title="Large text"
                description="Increase the size of all text in the app."
                value={largeText}
                onValueChange={(next) => setSetting('largeText', next)}
              />

              <View style={{ height: 1, backgroundColor: theme.colors.border }} />

              <ToggleRow
                icon="contrast-outline"
                title="High contrast"
                description="Stronger text and border colours for easier reading."
                value={highContrast}
                onValueChange={(next) => setSetting('highContrast', next)}
              />
            </View>
          </Card>

          <AppText variant="caption" color="textMuted">
            These take effect immediately and are remembered next time you open MediMind. High
            contrast replaces the colour theme with maximum-contrast black and white.
          </AppText>
        </View>

        {/* ---------- My health ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">My health</AppText>
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="body" color="textSecondary">
                Long-term conditions and readings you want to keep a note of. Stored as you type
                them, never interpreted.
              </AppText>
              <Button
                label="My health conditions"
                icon="heart-outline"
                variant="secondary"
                onPress={() => router.push('/health/conditions')}
                accessibilityHint="Opens the list of your health conditions"
              />
            </View>
          </Card>
        </View>

        {/* ---------- Not built yet ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">More settings</AppText>

          <Card>
            <View style={{ gap: theme.spacing.base }}>
              {UPCOMING_SETTINGS.map((item) => (
                <View
                  key={item.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    opacity: 0.6,
                  }}>
                  <Ionicons name={item.icon} size={22} color={theme.colors.textMuted} />
                  <AppText variant="body" color="textSecondary" style={{ flex: 1 }}>
                    {item.label}
                  </AppText>
                  <Badge label={item.milestone} tone="neutral" />
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* ---------- About ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">About {APP_NAME}</AppText>

          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Logo variant="lockup" size={40} showTagline />
              <AppText variant="body" color="textSecondary">
                {APP_TAGLINE}
              </AppText>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <AppText variant="caption" color="textSecondary">
                {MEDICAL_DISCLAIMER}
              </AppText>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              {/* Deployment readout - lets anyone confirm which backends this
                  build was configured with, without reading the bundle. */}
              <AppText variant="caption" color="textSecondary">
                Cloud database: {isSupabaseConfigured ? 'configured' : 'not configured (accounts stay on this device)'}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Assistant server: {isAssistantConfigured ? 'configured' : 'not configured (offline assistant only)'}
              </AppText>
              <AppText variant="caption" color="textMuted">
                Version {Constants.expoConfig?.version ?? '1.0.0'}
              </AppText>
            </View>
          </Card>
        </View>

        {/* ---------- Logout ---------- */}
        <Button
          label="Log out"
          icon="log-out-outline"
          variant="danger"
          onPress={confirmSignOut}
          accessibilityHint="Signs you out and returns to the login screen"
        />
      </View>
    </Screen>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.touch.comfortable,
      }}>
      <Ionicons name={icon} size={24} color={theme.colors.primary} />

      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="subheading">{title}</AppText>
        <AppText variant="caption" color="textSecondary">
          {description}
        </AppText>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        accessibilityHint={description}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}
