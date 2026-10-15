/**
 * Says, before a photo is taken, which reader will read it — so a demo
 * example can never be mistaken for a real reading.
 *
 *   Demo Mode on                      → "Demo reader on: the result will be
 *                                        an example, not your label", with a
 *                                        one-tap switch to the real reader.
 *   Demo Mode off, no server address  → "Real label reading is not set up",
 *                                        with a switch to Demo Mode.
 *   Demo Mode off, server configured  → nothing; the real reader runs.
 */

import { View } from 'react-native';

import { Button, InlineMessage } from '@/components/ui';
import { useT } from '@/i18n';
import { isRealScannerAvailable } from '@/services/scanner';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme/ThemeContext';

export function ScanModeBanner({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const { t } = useT();
  const demoMode = useSettingsStore((state) => state.demoMode);
  const setSetting = useSettingsStore((state) => state.set);
  const realAvailable = isRealScannerAvailable();

  const choose = (demo: boolean) => {
    setSetting('demoMode', demo);
    setSetting('demoModeChosen', true);
  };

  if (demoMode) {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <InlineMessage
          tone="warning"
          title={t('scan.demoOnTitle')}
          message={realAvailable ? t('scan.demoOnBody') : t('scan.demoOnBodyNoServer')}
        />
        {realAvailable ? (
          <Button
            label={t('scan.useRealReader')}
            icon="scan-outline"
            variant="secondary"
            fullWidth={!compact}
            onPress={() => choose(false)}
          />
        ) : null}
      </View>
    );
  }

  if (!realAvailable) {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <InlineMessage tone="warning" title={t('scan.noServerTitle')} message={t('scan.noServerBody')} />
        <Button label={t('scan.useDemoReader')} icon="flask-outline" variant="secondary" fullWidth={!compact} onPress={() => choose(true)} />
      </View>
    );
  }

  return null;
}
