/**
 * SCAN — the web version. The browser build cannot open a camera preview
 * inside the app shell, so it asks for a photo of the label instead (the
 * browser's own picker offers the phone camera on iOS and Android anyway).
 * The photo is read by exactly the same reader as on the phone.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { DemoScenarioPicker } from '@/components/scan/DemoScenarioPicker';
import { pickLabelPhoto } from '@/components/scan/pickLabelPhoto';
import { useStartScan } from '@/components/scan/useStartScan';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { memberById, selectActiveMemberId, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { useTheme } from '@/theme/ThemeContext';

export default function ScanScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const member = useMemo(() => memberById(members, activeMemberId), [members, activeMemberId]);
  const { start, demoMode, scenario, setScenario } = useStartScan();
  const [isPicking, setPicking] = useState(false);

  const choose = async () => {
    setPicking(true);
    try {
      const image = await pickLabelPhoto();
      if (image) start(image);
    } finally {
      setPicking(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.lg }}>
        {member && !member.isSelf ? <MemberContextBanner member={member} prefix={t('scan.scanningFor')} /> : null}

        <Card>
          <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: theme.radius.xl,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="camera-outline" size={44} color={theme.colors.primary} />
            </View>
            <AppText variant="heading" align="center">
              {t('scan.webTitle')}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {t('scan.webBody')}
            </AppText>
            <AppText variant="caption" color="textMuted" align="center">
              {t('scan.instructions')}
            </AppText>
          </View>
        </Card>

        <Button
          label={t('scan.choosePhoto')}
          icon="images-outline"
          size="large"
          onPress={() => void choose()}
          loading={isPicking}
        />
        <Button
          label={t('scan.enterManually')}
          icon="create-outline"
          variant="secondary"
          onPress={() =>
            router.replace({ pathname: '/medication/add', params: member ? { memberId: member.id } : {} })
          }
        />

        {demoMode ? (
          <Card>
            <DemoScenarioPicker value={scenario} onChange={setScenario} />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
