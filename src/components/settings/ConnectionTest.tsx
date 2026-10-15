/**
 * Settings → Scanner → "Test connection": three plain lines that say exactly
 * where a scan would fail — the internet, the MediMind server, or the AI
 * provider on it — using the same probes the scanner uses to explain a
 * failed request. Nothing about the user is sent.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useT } from '@/i18n';
import { healthEndpoint, probeInternet, probeServer, type ServerHealth } from '@/services/scanner/connectivity';
import { useTheme } from '@/theme/ThemeContext';

type Line = { ok: boolean; text: string };

export function ConnectionTest() {
  const theme = useTheme();
  const { t } = useT();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [isTesting, setTesting] = useState(false);

  const run = async () => {
    setTesting(true);
    try {
      const internet = await probeInternet();
      const result: Line[] = [{ ok: internet, text: internet ? t('settings.conn.internetOk') : t('settings.conn.internetDown') }];

      if (!healthEndpoint()) {
        result.push({ ok: false, text: t('settings.conn.serverNone') });
      } else {
        const health: ServerHealth = await probeServer();
        if (health.ok) {
          result.push({ ok: true, text: t('settings.conn.serverOk', { version: health.version ?? '?' }) });
          if (health.scan) {
            result.push({ ok: true, text: t('settings.conn.scanOk', { provider: health.provider ?? '?' }) });
          } else if (health.provider) {
            result.push({ ok: false, text: t('settings.conn.scanNoVision', { provider: health.provider }) });
          } else {
            result.push({ ok: false, text: t('settings.conn.scanNoProvider') });
          }
        } else if (health.status !== null) {
          result.push({ ok: false, text: t('settings.conn.serverStatus', { status: health.status }) });
        } else {
          result.push({ ok: false, text: t('settings.conn.serverDown') });
        }
      }
      setLines(result);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Button
        label={isTesting ? t('settings.testing') : t('settings.testConnection')}
        icon="pulse-outline"
        variant="secondary"
        onPress={() => void run()}
        loading={isTesting}
      />
      {lines ? (
        <View style={{ gap: theme.spacing.sm }}>
          {lines.map((line) => (
            <View key={line.text} style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
              <Ionicons
                name={line.ok ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={line.ok ? theme.colors.success : theme.colors.danger}
                style={{ marginTop: 2 }}
              />
              <AppText variant="body" style={{ flex: 1 }}>
                {line.text}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
