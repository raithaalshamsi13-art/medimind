/**
 * Privacy — a plain statement of what MediMind stores and where. Replaces the
 * "coming in Milestone 6" placeholder in Settings. Nothing here is a legal
 * document; it is the honest version for a graduation project.
 */

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText, Card, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

const SECTIONS = [
  { icon: 'phone-portrait-outline', title: 'privacy.onDevice', body: 'privacy.onDeviceBody' },
  { icon: 'person-circle-outline', title: 'privacy.account', body: 'privacy.accountBody' },
  { icon: 'sparkles-outline', title: 'privacy.ai', body: 'privacy.aiBody' },
  { icon: 'notifications-outline', title: 'privacy.notifications', body: 'privacy.notificationsBody' },
  { icon: 'trash-outline', title: 'privacy.delete', body: 'privacy.deleteBody' },
] as const;

export default function PrivacyScreen() {
  const theme = useTheme();
  const { t } = useT();

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">{t('privacy.title')}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('privacy.intro')}
          </AppText>
        </View>

        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Ionicons name={section.icon} size={22} color={theme.colors.primary} />
                <AppText variant="label" color="textMuted">
                  {t(section.title)}
                </AppText>
              </View>
              <AppText variant="body">{t(section.body)}</AppText>
            </View>
          </Card>
        ))}

        <AppText variant="caption" color="textMuted">
          {t('disclaimer.full')}
        </AppText>
      </View>
    </Screen>
  );
}
