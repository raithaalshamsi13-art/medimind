/**
 * SCAN — the camera screen (phone).
 *
 * A live preview with a framing guide, one large shutter button, and two
 * escape routes that are always visible: choose a photo from the library, or
 * give up on the camera and type the medicine in by hand. When the camera
 * permission is denied the same two routes are offered instead of a dead end.
 *
 * The web build has its own file (`index.web.tsx`) — the browser cannot open
 * the camera inside the app, so it goes straight to the photo picker.
 */

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { DemoScenarioPicker } from '@/components/scan/DemoScenarioPicker';
import { PhotoTray } from '@/components/scan/PhotoTray';
import { ScanModeBanner } from '@/components/scan/ScanModeBanner';
import { pickLabelPhoto, pickLabelPhotos } from '@/components/scan/pickLabelPhoto';
import { useStartScan } from '@/components/scan/useStartScan';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { MAX_SCAN_PHOTOS, type ScanImage } from '@/services/scanner';
import { useScanStore } from '@/stores/useScanStore';
import { memberById, selectActiveMemberId, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { useTheme } from '@/theme/ThemeContext';

/** Compression for the shutter photo; label text survives this easily. */
const CAPTURE_QUALITY = 0.85;

export default function ScanScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const member = useMemo(() => memberById(members, activeMemberId), [members, activeMemberId]);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraReady, setCameraReady] = useState(false);
  const [isCapturing, setCapturing] = useState(false);
  const { start, demoMode, scenario, setScenario } = useStartScan();

  // "Several photos" mode: the shutter and the library add to a tray, and one
  // button scans them all as ONE medicine. Off by default, so the single-photo
  // flow is untouched. `keep=1` (from "Add more photos") starts with the
  // photos of the previous scan.
  const { keep } = useLocalSearchParams<{ keep?: string }>();
  const keptPhotos = useScanStore((state) => state.images);
  const [multi, setMulti] = useState(keep === '1');
  const [tray, setTray] = useState<ScanImage[]>(() => (keep === '1' ? keptPhotos : []));
  const [justAdded, setJustAdded] = useState(false);
  const addToTray = (photos: ScanImage[]) => {
    setTray((current) => [...current, ...photos].slice(0, MAX_SCAN_PHOTOS));
    setJustAdded(true);
  };

  const enterManually = () =>
    router.replace({ pathname: '/medication/add', params: member ? { memberId: member.id } : {} });

  const chooseFromLibrary = async () => {
    if (multi) {
      const photos = await pickLabelPhotos(MAX_SCAN_PHOTOS - tray.length);
      if (photos.length > 0) addToTray(photos);
      return;
    }
    const image = await pickLabelPhoto();
    if (image) start(image);
  };

  const capture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: CAPTURE_QUALITY });
      if (photo?.base64) {
        const image: ScanImage = { uri: photo.uri, base64: photo.base64, mimeType: 'image/jpeg', width: photo.width, height: photo.height };
        if (multi) addToTray([image]);
        else start(image);
      }
    } finally {
      setCapturing(false);
    }
  };

  // ---- Permission states --------------------------------------------------
  if (!permission) {
    return (
      <Screen center>
        <ActivityIndicator color={theme.colors.primary} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          {member && !member.isSelf ? <MemberContextBanner member={member} prefix={t('scan.scanningFor')} /> : null}
          <ScanModeBanner />
          <Card>
            <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
              <Ionicons name="camera-outline" size={44} color={theme.colors.primary} />
              <AppText variant="heading" align="center">
                {t('scan.permissionTitle')}
              </AppText>
              <AppText variant="body" color="textSecondary" align="center">
                {permission.canAskAgain ? t('scan.permissionBody') : t('scan.permissionDenied')}
              </AppText>
            </View>
          </Card>
          {permission.canAskAgain ? (
            <Button label={t('scan.allowCamera')} icon="camera" size="large" onPress={() => void requestPermission()} />
          ) : (
            <Button label={t('scan.allowCamera')} icon="settings-outline" size="large" onPress={() => void Linking.openSettings()} />
          )}
          <Button label={t('scan.choosePhoto')} icon="images-outline" variant="secondary" onPress={() => void chooseFromLibrary()} />
          <Button label={t('scan.enterManually')} icon="create-outline" variant="ghost" onPress={enterManually} />
          {demoMode ? (
            <Card>
              <DemoScenarioPicker value={scenario} onChange={setScenario} />
            </Card>
          ) : null}
        </View>
      </Screen>
    );
  }

  // ---- Camera -------------------------------------------------------------
  return (
    <Screen padded={false} edges={['left', 'right']}>
      <View style={styles.flex}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Framing guide: a dimmed surround with a clear window, so the user
            fills the window with the label rather than photographing the room. */}
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.dim} />
          <View style={styles.middleRow}>
            <View style={styles.dim} />
            <View style={[styles.window, { borderColor: theme.colors.primaryText, borderRadius: theme.radius.lg }]} />
            <View style={styles.dim} />
          </View>
          <View style={[styles.dim, { justifyContent: 'flex-start', alignItems: 'center', paddingTop: 16 }]}>
            <View style={[styles.instruction, { borderRadius: theme.radius.md }]}>
              <AppText variant="body" align="center" style={{ color: '#FFFFFF' }}>
                {t('scan.instructions')}
              </AppText>
            </View>
          </View>
        </View>

        {member && !member.isSelf ? (
          <View style={[styles.topBanner, { padding: theme.spacing.md }]}>
            <MemberContextBanner member={member} prefix={t('scan.scanningFor')} />
          </View>
        ) : null}

        {/* Controls */}
        <View
          style={[
            styles.controls,
            {
              backgroundColor: theme.colors.surface,
              paddingHorizontal: theme.layout.screenPadding,
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.xl,
              gap: theme.spacing.md,
            },
          ]}>
          <ScanModeBanner compact />
          {demoMode ? <DemoScenarioPicker value={scenario} onChange={setScenario} compact /> : null}

          <Pressable
            onPress={() => setMulti((on) => !on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: multi }}
            accessibilityLabel={t('scan.multi.toggle')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 36 }}>
            <Ionicons
              name={multi ? 'checkbox' : 'square-outline'}
              size={24}
              color={multi ? theme.colors.primary : theme.colors.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="body">{t('scan.multi.toggle')}</AppText>
              {multi ? (
                <AppText variant="caption" color="textSecondary">
                  {justAdded && tray.length < MAX_SCAN_PHOTOS ? t('scan.multi.added') : t('scan.multi.hint')}
                </AppText>
              ) : null}
            </View>
          </Pressable>

          {multi && tray.length > 0 ? (
            <PhotoTray
              photos={tray}
              max={MAX_SCAN_PHOTOS}
              onRemove={(index) => setTray((current) => current.filter((_, i) => i !== index))}
              onScanAll={() => start(tray)}
              compact
            />
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SideAction icon="images-outline" label={t('scan.choosePhoto')} onPress={() => void chooseFromLibrary()} />

            <Pressable
              onPress={() => void capture()}
              disabled={!isCameraReady || isCapturing}
              accessibilityRole="button"
              accessibilityLabel={t('scan.capture')}
              accessibilityState={{ disabled: !isCameraReady || isCapturing }}
              style={({ pressed }) => ({
                width: 84,
                height: 84,
                borderRadius: 42,
                borderWidth: 5,
                borderColor: theme.colors.primary,
                backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !isCameraReady || isCapturing ? 0.5 : 1,
              })}>
              {isCapturing ? (
                <ActivityIndicator color={theme.colors.primaryText} />
              ) : (
                <Ionicons name="camera" size={36} color={theme.colors.primaryText} />
              )}
            </Pressable>

            <SideAction icon="create-outline" label={t('scan.enterManually')} onPress={enterManually} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function SideAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 96, alignItems: 'center', gap: theme.spacing.xs, minHeight: theme.touch.comfortable }}>
      <Ionicons name={icon} size={28} color={theme.colors.primary} />
      <AppText variant="caption" color="textSecondary" align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  middleRow: { flexDirection: 'row', height: '46%' },
  window: { width: '84%', borderWidth: 3 },
  instruction: { backgroundColor: 'rgba(0, 0, 0, 0.55)', paddingHorizontal: 16, paddingVertical: 10, maxWidth: '90%' },
  topBanner: { position: 'absolute', top: 0, left: 0, right: 0 },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
