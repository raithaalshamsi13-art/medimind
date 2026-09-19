/**
 * Settings.
 *
 * Everything here works today: profile, language, appearance, accessibility
 * switches (wired through the theme), reminder notifications, health and
 * family shortcuts, about, log out. Features still to come are listed but
 * visibly inactive, rather than being a switch that silently does nothing.
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { isAssistantConfigured, isSupabaseConfigured } from '@/config/env';
import { Logo } from '@/components/brand/Logo';
import {
  AppText,
  Badge,
  Button,
  Card,
  ChoiceChips,
  InlineMessage,
  OptionGroup,
  Screen,
  type ChipOption,
  type Option,
} from '@/components/ui';
import { APP_NAME, APP_TAGLINE } from '@/config/constants';
import { firstNameOf } from '@/domain/user';
import { applyDirection, LANGUAGES, reloadApp, useT, type Language } from '@/i18n';
import { confirmAction } from '@/lib/confirm';
import { isStoragePersistent } from '@/lib/storage';
import { getNotificationService } from '@/services/notifications';
import { getVoiceService } from '@/services/voice/VoiceService';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { selectSelf, useFamilyStore } from '@/stores/useFamilyStore';
import { selectMedications, useMedicationStore } from '@/stores/useMedicationStore';
import { useReminderStore } from '@/stores/useReminderStore';
import { useSettingsStore, type AlertStyle, type AppearancePreference } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme/ThemeContext';
import { PALETTE_LIST, type PaletteId } from '@/theme/palettes';

/** Built from the palette registry, so adding a palette needs no change here. */
const PALETTE_OPTIONS: readonly Option<PaletteId>[] = PALETTE_LIST.map((palette) => ({
  value: palette.id,
  label: palette.name,
  description: palette.description,
  swatch: palette.swatch,
}));

const LANGUAGE_OPTIONS: readonly ChipOption<Language>[] = LANGUAGES.map((language) => ({
  value: language.code,
  label: language.nativeLabel,
}));


export default function SettingsScreen() {
  const theme = useTheme();
  const { t, language } = useT();
  const router = useRouter();

  const user = useAuthStore(selectUser);
  const self = useFamilyStore(selectSelf);
  const isLocalOnly = useAuthStore((state) => state.isLocalOnly);
  const signOut = useAuthStore((state) => state.signOut);

  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const voiceAlertsEnabled = useSettingsStore((state) => state.voiceAlertsEnabled);
  const alertStyle = useSettingsStore((state) => state.alertStyle);
  const largeText = useSettingsStore((state) => state.largeText);
  const highContrast = useSettingsStore((state) => state.highContrast);
  const appearance = useSettingsStore((state) => state.appearance);
  const paletteId = useSettingsStore((state) => state.paletteId);
  const setSetting = useSettingsStore((state) => state.set);

  const rescheduleAll = useReminderStore((state) => state.rescheduleAll);
  const medications = useMedicationStore(selectMedications);
  const notificationsAvailable = getNotificationService().isAvailable;

  const [needsReload, setNeedsReload] = useState(false);

  const alertStyleOptions: readonly ChipOption<AlertStyle>[] = [
    { value: 'both', label: t('settings.alertStyle.both'), icon: 'notifications-outline' },
    { value: 'sound', label: t('settings.alertStyle.sound'), icon: 'musical-note-outline' },
    { value: 'voice', label: t('settings.alertStyle.voice'), icon: 'volume-high-outline' },
  ];

  const appearanceOptions: readonly Option<AppearancePreference>[] = [
    {
      value: 'system',
      label: t('settings.appearance.system'),
      description: t('settings.appearance.systemDesc'),
      icon: 'phone-portrait-outline',
    },
    {
      value: 'light',
      label: t('settings.appearance.light'),
      description: t('settings.appearance.lightDesc'),
      icon: 'sunny-outline',
    },
    {
      value: 'dark',
      label: t('settings.appearance.dark'),
      description: t('settings.appearance.darkDesc'),
      icon: 'moon-outline',
    },
  ];

  const changeLanguage = (next: Language | null) => {
    if (!next || next === language) return;
    setSetting('language', next);
    // Text changes at once; on the phone the layout direction needs a reload.
    const { needsReload: reload } = applyDirection(next);
    setNeedsReload(reload);
  };

  const toggleNotifications = async (next: boolean) => {
    setSetting('notificationsEnabled', next);
    if (!user) return;
    if (next) {
      const permission = await getNotificationService().requestPermission();
      if (permission !== 'granted' && notificationsAvailable) return;
      await rescheduleAll(user.id, new Map(medications.map((m) => [m.id, m.name])));
    } else {
      await getNotificationService().cancelAll();
      await rescheduleAll(user.id, new Map());
    }
  };

  const confirmSignOut = async () => {
    // confirmAction, not Alert.alert: the native alert is a silent no-op in
    // the browser, which made "Log out" do nothing on the web build.
    const confirmed = await confirmAction({
      title: t('settings.logOutTitle'),
      message: t('settings.logOutBody'),
      confirmLabel: t('settings.logOut'),
      destructive: true,
    });
    if (confirmed) await signOut();
  };

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.xl }}>
        <AppText variant="title">{t('settings.title')}</AppText>

        {isStoragePersistent() ? null : (
          <InlineMessage
            tone="warning"
            title={t('settings.dataNotSavedTitle')}
            message={t('settings.dataNotSavedBody')}
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
              <AppText variant="subheading">{user?.displayName ?? t('settings.userFallback')}</AppText>
              <AppText variant="caption" color="textSecondary">
                {user?.email ?? t('settings.notSignedIn')}
              </AppText>
              <Badge
                label={isLocalOnly ? t('settings.savedOnDevice') : t('settings.cloudAccount')}
                tone={isLocalOnly ? 'neutral' : 'success'}
                icon={isLocalOnly ? 'phone-portrait-outline' : 'cloud-done-outline'}
              />
            </View>
          </View>
          {self ? (
            <Button
              label={t('settings.myProfile')}
              icon="person-circle-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/family/[id]', params: { id: self.id } })}
              accessibilityHint={t('settings.myProfileHint')}
              style={{ marginTop: theme.spacing.md }}
            />
          ) : null}
        </Card>

        {/* ---------- Language ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('settings.language')}</AppText>
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Ionicons name="language-outline" size={24} color={theme.colors.primary} />
                <AppText variant="body" color="textSecondary" style={{ flex: 1 }}>
                  {t('settings.languageBody')}
                </AppText>
              </View>
              <ChoiceChips
                options={LANGUAGE_OPTIONS}
                value={language}
                onChange={changeLanguage}
                accessibilityLabel={t('settings.languageLabel')}
                allowClear={false}
              />
              {needsReload ? (
                <View style={{ gap: theme.spacing.md }}>
                  <InlineMessage
                    tone="info"
                    title={t('settings.reloadTitle')}
                    message={t('settings.reloadBody')}
                  />
                  <Button
                    label={t('settings.reloadNow')}
                    icon="refresh"
                    variant="secondary"
                    onPress={() => {
                      if (!reloadApp()) setNeedsReload(true);
                    }}
                  />
                </View>
              ) : null}
            </View>
          </Card>
        </View>

        {/* ---------- Appearance ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('settings.appearance')}</AppText>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textMuted">
              {t('settings.lightOrDark')}
            </AppText>
            <OptionGroup
              accessibilityLabel={t('settings.lightOrDarkLabel')}
              options={appearanceOptions}
              value={appearance}
              onChange={(next) => setSetting('appearance', next)}
            />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textMuted">
              {t('settings.colourTheme')}
            </AppText>
            <OptionGroup
              accessibilityLabel={t('settings.colourThemeLabel')}
              options={PALETTE_OPTIONS}
              value={paletteId}
              onChange={(next) => setSetting('paletteId', next)}
            />
          </View>

          <AppText variant="caption" color="textMuted">
            {t('settings.themeNote')}
          </AppText>
        </View>

        {/* ---------- Accessibility ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('settings.accessibility')}</AppText>

          <Card>
            <View style={{ gap: theme.spacing.base }}>
              <ToggleRow
                icon="text-outline"
                title={t('settings.largeText')}
                description={t('settings.largeTextDesc')}
                value={largeText}
                onValueChange={(next) => setSetting('largeText', next)}
              />

              <View style={{ height: 1, backgroundColor: theme.colors.border }} />

              <ToggleRow
                icon="contrast-outline"
                title={t('settings.highContrast')}
                description={t('settings.highContrastDesc')}
                value={highContrast}
                onValueChange={(next) => setSetting('highContrast', next)}
              />
            </View>
          </Card>

          <AppText variant="caption" color="textMuted">
            {t('settings.accessibilityNote')}
          </AppText>
        </View>

        {/* ---------- Reminders ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('settings.reminders')}</AppText>
          <Card>
            <View style={{ gap: theme.spacing.base }}>
              <ToggleRow
                icon="notifications-outline"
                title={t('settings.notifTitle')}
                description={notificationsAvailable ? t('settings.notifDesc') : t('settings.notifDescWeb')}
                value={notificationsEnabled}
                onValueChange={(next) => void toggleNotifications(next)}
              />
            </View>
          </Card>
          <AppText variant="caption" color="textMuted">
            {t('settings.remindersNote')}
          </AppText>

          {/* ---------- Voice alerts (Phase 13) ---------- */}
          <Card>
            <View style={{ gap: theme.spacing.base }}>
              <ToggleRow
                icon="volume-high-outline"
                title={t('settings.voiceTitle')}
                description={t('settings.voiceDesc')}
                value={voiceAlertsEnabled}
                onValueChange={(next) => {
                  setSetting('voiceAlertsEnabled', next);
                  if (!next) getVoiceService().stop();
                }}
              />
              {voiceAlertsEnabled ? (
                <>
                  <View style={{ height: 1, backgroundColor: theme.colors.border }} />
                  <View style={{ gap: theme.spacing.sm }}>
                    <AppText variant="label" color="textMuted">
                      {t('settings.alertStyle')}
                    </AppText>
                    <ChoiceChips
                      options={alertStyleOptions}
                      value={alertStyle}
                      onChange={(next) => next && setSetting('alertStyle', next)}
                      accessibilityLabel={t('settings.alertStyle')}
                      allowClear={false}
                    />
                  </View>
                  <Button
                    label={t('settings.testVoice')}
                    icon="play-outline"
                    variant="secondary"
                    onPress={() => void getVoiceService().speak(t('voice.example'), language)}
                  />
                </>
              ) : null}
            </View>
          </Card>
          <AppText variant="caption" color="textMuted">
            {t('settings.voiceNote')}
          </AppText>
        </View>

        {/* ---------- My health ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('settings.myHealth')}</AppText>
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="body" color="textSecondary">
                {t('settings.myHealthBody')}
              </AppText>
              <Button
                label={t('settings.healthConditions')}
                icon="heart-outline"
                variant="secondary"
                onPress={() => router.push('/health/conditions')}
                accessibilityHint={t('settings.healthConditionsHint')}
              />
              <Button
                label={t('settings.familyMembers')}
                icon="people-outline"
                variant="secondary"
                onPress={() => router.push('/family')}
                accessibilityHint={t('settings.familyMembersHint')}
              />
            </View>
          </Card>
        </View>

        {/* ---------- Privacy ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('settings.moreSettings')}</AppText>
          <Card>
            <Button
              label={t('settings.privacy')}
              icon="lock-closed-outline"
              variant="secondary"
              onPress={() => router.push('/about/privacy')}
              accessibilityHint={t('settings.privacyHint')}
            />
          </Card>
        </View>

        {/* ---------- About ---------- */}
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="heading">{t('settings.about', { app: APP_NAME })}</AppText>

          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Logo variant="lockup" size={40} showTagline />
              <AppText variant="body" color="textSecondary">
                {APP_TAGLINE}
              </AppText>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <AppText variant="caption" color="textSecondary">
                {t('disclaimer.full')}
              </AppText>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <AppText variant="caption" color="textSecondary">
                {t('settings.cloudDatabase', {
                  state: isSupabaseConfigured ? t('settings.configured') : t('settings.notConfiguredAccounts'),
                })}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('settings.assistantServer', {
                  state: isAssistantConfigured ? t('settings.configured') : t('settings.notConfiguredOffline'),
                })}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
              </AppText>
            </View>
          </Card>
        </View>

        {/* ---------- Logout ---------- */}
        <Button
          label={t('settings.logOut')}
          icon="log-out-outline"
          variant="danger"
          onPress={() => void confirmSignOut()}
          accessibilityHint={t('settings.logOutHint')}
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
