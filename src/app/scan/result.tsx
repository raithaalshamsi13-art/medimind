/**
 * CHECK → CONFIRM — what the reader found, beside the photo.
 *
 * Layout: the medicine details come first, in large print (this screen is
 * for people who may not see well — nothing here is smaller than body text,
 * and the name is the biggest thing on the page). On a wide screen the photo
 * sits on the left and the details + exact label text on the right; on a
 * phone they stack. The text panel is exactly what was read, selectable and
 * scrollable, so the user can compare it with the pack. Each field is marked
 * "Read from label", "Check this" (read with low confidence) or "Not on the
 * label".
 *
 * Arabic: when the app is in Arabic the reader also returns the wording in
 * Arabic; the details and the text panel show it, with the printed original
 * one tap away. The medicine is always saved with the printed wording.
 *
 * Voice: the details are read aloud once when the reading arrives (if voice
 * alerts are on), in the app's language, and again on "Read aloud".
 *
 * Saving: when the name was read confidently the medicine is added to the
 * list automatically as soon as the reading arrives. Otherwise the user is
 * asked to type the name first — the app never guesses a name. A medicine
 * with the same name for the same person is never added twice without the
 * user saying so.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { scanAnnouncement } from '@/components/scan/scanSpeech';
import { AppText, Badge, Button, Card, ChoiceChips, InlineMessage, Screen, TextField, type ChipOption } from '@/components/ui';
import {
  displayField,
  isUncertain,
  needsNameConfirmation,
  SCANNED_MEDICATION_FIELDS,
  type ScanField,
  type ScanResult,
} from '@/domain/scan';
import { useT, type TranslationKey } from '@/i18n';
import { localizeMessage } from '@/i18n/labels';
import { formatIsoDate } from '@/lib/datetime';
import { readerKind } from '@/services/scanner';
import { getVoiceService } from '@/services/voice/VoiceService';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { memberById, selectActiveMemberId, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useScanStore } from '@/stores/useScanStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme/ThemeContext';

/** Photo and details sit side by side from this width up. */
const SIDE_BY_SIDE_MIN_WIDTH = 720;

/** Error codes that have their own headline on the failure screen. */
const FAILURE_TITLES: readonly string[] = [
  'NETWORK_UNAVAILABLE',
  'SERVER_UNREACHABLE',
  'SCAN_APP_KEY_REJECTED',
  'SCAN_PROVIDER_KEY_INVALID',
  'SCAN_NO_VISION',
  'SCAN_RATE_LIMITED',
  'SCAN_PROVIDER_BUSY',
  'SCAN_IMAGE_TOO_LARGE',
  'SCAN_TIMEOUT',
  'SCAN_SERVER_ERROR',
  'SCAN_DEVICE_ERROR',
  'SCANNER_NOT_CONFIGURED',
];

type TextTab = 'translated' | 'original';

export default function ScanResultScreen() {
  const theme = useTheme();
  const { t, language } = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const sideBySide = width >= SIDE_BY_SIDE_MIN_WIDTH;

  const user = useAuthStore(selectUser);
  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const member = useMemo(() => memberById(members, activeMemberId), [members, activeMemberId]);
  const voiceAlertsEnabled = useSettingsStore((state) => state.voiceAlertsEnabled);

  const phase = useScanStore((state) => state.phase);
  const image = useScanStore((state) => state.image);
  const result = useScanStore((state) => state.result);
  const error = useScanStore((state) => state.error);
  const isSaving = useScanStore((state) => state.isSaving);
  const duplicateOf = useScanStore((state) => state.duplicateOf);
  const savedMedicationId = useScanStore((state) => state.savedMedicationId);
  const save = useScanStore((state) => state.save);
  const reset = useScanStore((state) => state.reset);
  const run = useScanStore((state) => state.run);
  const demoMode = useSettingsStore((state) => state.demoMode);
  /** Send the same photo again after a connection problem. */
  const rerun = (photo: NonNullable<typeof image>) => run(photo, { demoMode, language });

  const saved = useMedicationStore((state) =>
    savedMedicationId ? (state.medications.find((m) => m.id === savedMedicationId) ?? null) : null,
  );

  const [confirmedName, setConfirmedName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isEnlarged, setEnlarged] = useState(false);
  const [textTab, setTextTab] = useState<TextTab>('translated');
  const [isSpeaking, setSpeaking] = useState(false);

  // Auto-add: once the reading is in and the name is trustworthy, save it —
  // once. `useRef` so a re-render never triggers a second save.
  const autoSaved = useRef(false);
  useEffect(() => {
    if (phase !== 'reviewing' || !result || !user || !member || autoSaved.current) return;
    if (needsNameConfirmation(result)) return;
    autoSaved.current = true;
    void save(user.id, member.id);
  }, [phase, result, user, member, save]);

  // Speak the reading once when it arrives, in the app's language.
  const speak = async (reading: ScanResult) => {
    setSpeaking(true);
    try {
      await getVoiceService().speak(scanAnnouncement(reading, t, language), language);
    } finally {
      setSpeaking(false);
    }
  };
  const stopSpeaking = () => {
    getVoiceService().stop();
    setSpeaking(false);
  };
  const announced = useRef<ScanResult | null>(null);
  useEffect(() => {
    if (!result || (phase !== 'reviewing' && phase !== 'saved') || announced.current === result) return;
    announced.current = result;
    if (!voiceAlertsEnabled) return;
    // Next tick, so the effect itself never sets state synchronously.
    const timer = setTimeout(() => void speak(result), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, phase]);
  useEffect(() => () => getVoiceService().stop(), []);

  const submitName = async (force = false) => {
    if (!user || !member) return;
    const name = confirmedName.trim();
    if (name.length === 0) {
      setNameError(t('validation.medicineName'));
      return;
    }
    setNameError(null);
    await save(user.id, member.id, { confirmedName: name, force });
  };

  const saveAnyway = () => {
    if (!user || !member || !result) return;
    void save(user.id, member.id, {
      confirmedName: needsNameConfirmation(result) ? confirmedName.trim() : undefined,
      force: true,
    });
  };

  const leave = (go: () => void) => {
    stopSpeaking();
    reset();
    go();
  };
  const retake = () => leave(() => router.back());
  const scanAnother = () => leave(() => router.replace('/scan'));
  const enterManually = () =>
    leave(() => router.replace({ pathname: '/medication/add', params: member ? { memberId: member.id } : {} }));
  const finish = () => leave(() => router.replace('/medications'));

  // ---- Reading -------------------------------------------------------------
  if (phase === 'idle' || phase === 'scanning') {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg, alignItems: 'center', paddingTop: theme.spacing.xl }}>
          {image ? <LabelPhoto uri={image.uri} onPress={() => setEnlarged(true)} height={220} /> : null}
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="heading" align="center">
            {t('scan.reading')}
          </AppText>
          <AppText variant="bodyLarge" color="textSecondary" align="center">
            {t('scan.readingBody')}
          </AppText>
        </View>
        {image ? <EnlargedPhoto uri={image.uri} visible={isEnlarged} onClose={() => setEnlarged(false)} /> : null}
      </Screen>
    );
  }

  // ---- Failed --------------------------------------------------------------
  if (phase === 'failed' || !result) {
    // Say what actually happened — offline, server down, key rejected, too
    // large, timed out — not a generic "could not be read".
    const code = error?.code;
    const title =
      code && FAILURE_TITLES.includes(code) ? t(`scan.fail.${code}` as TranslationKey) : t('scan.fail.other');
    const connectionProblem =
      code === 'NETWORK_UNAVAILABLE' ||
      code === 'SERVER_UNREACHABLE' ||
      code === 'SCAN_TIMEOUT' ||
      code === 'SCAN_PROVIDER_BUSY' ||
      code === 'SCAN_RATE_LIMITED' ||
      code === 'SCAN_SERVER_ERROR';
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="danger"
            title={title}
            message={error ? localizeMessage(error.message) : t('scan.notReadable')}
          />
          {code === 'NETWORK_UNAVAILABLE' ? <InlineMessage tone="info" message={t('scan.offlineNote')} /> : null}
          {connectionProblem && image ? (
            <Button
              label={t('scan.tryAgain')}
              icon="refresh"
              onPress={() => {
                if (user) void rerun(image);
              }}
            />
          ) : null}
          <Button label={t('scan.retake')} icon="camera-outline" variant={connectionProblem ? 'secondary' : 'primary'} onPress={retake} />
          <Button label={t('scan.enterManually')} icon="create-outline" variant="secondary" onPress={enterManually} />
        </View>
      </Screen>
    );
  }

  const nameNeeded = needsNameConfirmation(result);
  const nothingRead =
    result.rawText.trim().length === 0 && SCANNED_MEDICATION_FIELDS.every((f) => result.fields[f] === null);
  const memberName = member?.name ?? '';

  const translation = language === 'ar' ? result.translation : null;
  const hasTranslatedText = Boolean(translation && translation.rawText.trim().length > 0);
  const panelText = hasTranslatedText && textTab === 'translated' ? translation!.rawText : result.rawText;
  const textTabs: readonly ChipOption<TextTab>[] = [
    { value: 'translated', label: t('scan.translatedTab') },
    { value: 'original', label: t('scan.originalTab') },
  ];

  const outcome =
    phase === 'saved' && saved ? (
      <View style={{ gap: theme.spacing.md }}>
        <InlineMessage
          tone="success"
          title={t('scan.addedTitle')}
          message={
            member?.isSelf === false
              ? t('scan.addedBody', { name: saved.name, member: memberName })
              : t('scan.addedBodyMe', { name: saved.name })
          }
        />
        {saved.safetyStatus === 'EXPIRED' ? (
          <InlineMessage tone="danger" message={t('scan.expiredNote')} />
        ) : saved.safetyStatus === 'NEEDS_REVIEW' ? (
          <InlineMessage tone="warning" message={t('scan.needsReviewNote')} />
        ) : null}
        <Button
          label={t('scan.openMedicine')}
          icon="open-outline"
          onPress={() => leave(() => router.replace({ pathname: '/medication/[id]', params: { id: saved.id } }))}
        />
        {saved.safetyStatus === 'EXPIRED' ? null : (
          <Button
            label={t('scan.setReminder')}
            icon="alarm-outline"
            variant="secondary"
            onPress={() =>
              leave(() =>
                router.replace({ pathname: '/reminder/[medicationId]', params: { medicationId: saved.id, new: '1' } }),
              )
            }
          />
        )}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Button label={t('scan.scanAnother')} icon="camera-outline" variant="secondary" onPress={scanAnother} style={{ flex: 1 }} />
          <Button label={t('scan.done')} icon="checkmark" variant="ghost" onPress={finish} style={{ flex: 1 }} />
        </View>
      </View>
    ) : duplicateOf ? (
      <View style={{ gap: theme.spacing.md }}>
        <InlineMessage
          tone="warning"
          title={t('scan.duplicateTitle')}
          message={
            member?.isSelf === false
              ? t('scan.duplicateBody', { name: duplicateOf.name, member: memberName })
              : t('scan.duplicateBodyMe', { name: duplicateOf.name })
          }
        />
        <Button
          label={t('scan.openExisting')}
          icon="open-outline"
          onPress={() => leave(() => router.replace({ pathname: '/medication/[id]', params: { id: duplicateOf.id } }))}
        />
        <Button label={t('scan.saveAnyway')} icon="add" variant="secondary" onPress={saveAnyway} loading={isSaving} />
        <Button label={t('scan.scanAnother')} icon="camera-outline" variant="ghost" onPress={scanAnother} />
      </View>
    ) : isSaving || (!nameNeeded && phase === 'reviewing' && !error) ? (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <ActivityIndicator color={theme.colors.primary} />
          <AppText variant="bodyLarge" color="textSecondary">
            {t('scan.adding')}
          </AppText>
        </View>
      </Card>
    ) : nameNeeded ? (
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <InlineMessage
            tone="warning"
            title={t('scan.notIdentified')}
            message={nothingRead ? t('scan.notReadable') : t('scan.notIdentifiedBody')}
          />
          <AppText variant="heading">{t('scan.confirmNameTitle')}</AppText>
          <AppText variant="bodyLarge" color="textSecondary">
            {t('scan.confirmNameBody')}
          </AppText>
          <TextField
            label={t('scan.nameLabel')}
            value={confirmedName}
            onChangeText={(next) => {
              setConfirmedName(next);
              if (nameError) setNameError(null);
            }}
            placeholder={result.fields.name ?? undefined}
            autoCapitalize="words"
            error={nameError}
            returnKeyType="done"
            onSubmitEditing={() => void submitName()}
          />
          {error ? <InlineMessage tone="danger" message={localizeMessage(error.message)} /> : null}
          <Button label={t('scan.saveToList')} icon="checkmark" onPress={() => void submitName()} loading={isSaving} />
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Button label={t('scan.retake')} icon="camera-outline" variant="secondary" onPress={retake} style={{ flex: 1 }} />
            <Button label={t('scan.enterManually')} icon="create-outline" variant="ghost" onPress={enterManually} style={{ flex: 1 }} />
          </View>
        </View>
      </Card>
    ) : error ? (
      <View style={{ gap: theme.spacing.md }}>
        <InlineMessage tone="danger" message={localizeMessage(error.message)} />
        <Button label={t('scan.retake')} icon="camera-outline" variant="secondary" onPress={retake} />
      </View>
    ) : null;

  const details = (
    <Card>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="label" color="textMuted">
              {t('scan.summaryTitle').toUpperCase()}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('scan.summaryBody')}
            </AppText>
          </View>
          <Button
            label={isSpeaking ? t('scan.stopReading') : t('scan.readAloud')}
            icon={isSpeaking ? 'stop-circle-outline' : 'volume-high-outline'}
            variant="secondary"
            fullWidth={false}
            onPress={() => (isSpeaking ? stopSpeaking() : void speak(result))}
            accessibilityHint={t('scan.readAloudHint')}
          />
        </View>

        {/* The name — the biggest text on the page. */}
        <NameBlock result={result} language={language} />

        <View style={{ height: 1, backgroundColor: theme.colors.border }} />

        <FieldRow label={t('detail.dosage')} field="dosage" result={result} language={language} />
        <FieldRow label={t('detail.howOften')} field="frequency" result={result} language={language} />
        <FieldRow label={t('detail.instructions')} field="instructions" result={result} language={language} />
        <FieldRow label={t('detail.expiryDate')} field="expirationDate" result={result} language={language} />
        <FieldRow label={t('scan.activeIngredients')} field="activeIngredients" result={result} language={language} />
        <FieldRow label={t('scan.form')} field="form" result={result} language={language} />
        <FieldRow label={t('scan.manufacturer')} field="manufacturer" result={result} language={language} />

        {translation ? (
          <AppText variant="caption" color="textMuted">
            {t('scan.translationNote')}
          </AppText>
        ) : null}
        {readerKind(demoMode) === 'device' ? (
          <AppText variant="caption" color="textMuted">
            {t('scan.deviceNote')}
          </AppText>
        ) : null}
      </View>
    </Card>
  );

  const photo = image ? (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" color="textMuted">
        {t('scan.photo').toUpperCase()}
      </AppText>
      <LabelPhoto uri={image.uri} onPress={() => setEnlarged(true)} height={sideBySide ? 420 : 240} />
      <AppText variant="caption" color="textMuted" align="center">
        {t('scan.tapToEnlarge')}
      </AppText>
    </View>
  ) : null;

  const textPanel = (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" color="textMuted">
        {t('scan.textTitle').toUpperCase()}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        {t('scan.textBody')}
      </AppText>
      {hasTranslatedText ? (
        <ChoiceChips options={textTabs} value={textTab} onChange={(next) => next && setTextTab(next)} accessibilityLabel={t('scan.textTitle')} allowClear={false} />
      ) : null}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderStrong,
          borderRadius: theme.radius.lg,
          maxHeight: sideBySide ? 380 : 300,
        }}>
        <ScrollView nestedScrollEnabled style={{ maxHeight: sideBySide ? 380 : 300 }} contentContainerStyle={{ padding: theme.spacing.base }}>
          {panelText.trim().length > 0 ? (
            <AppText variant="bodyLarge" selectable style={{ lineHeight: 30 }}>
              {panelText}
            </AppText>
          ) : (
            <AppText variant="bodyLarge" color="textMuted" style={{ fontStyle: 'italic' }}>
              {t('scan.noText')}
            </AppText>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.xl }}>
        {member && !member.isSelf ? <MemberContextBanner member={member} prefix={t('scan.scanningFor')} /> : null}

        {outcome}

        {result.warnings.length > 0 ? (
          <InlineMessage tone="warning" title={t('scan.warnings')} message={result.warnings.join('\n')} />
        ) : null}

        {sideBySide ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>{photo}</View>
            <View style={{ flex: 1.3, gap: theme.spacing.lg }}>
              {details}
              {textPanel}
            </View>
          </View>
        ) : (
          <>
            {details}
            {photo}
            {textPanel}
          </>
        )}

        {phase === 'saved' ? null : (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Button label={t('scan.retake')} icon="camera-outline" variant="secondary" onPress={retake} style={{ flex: 1 }} />
            <Button label={t('scan.enterManually')} icon="create-outline" variant="ghost" onPress={enterManually} style={{ flex: 1 }} />
          </View>
        )}
      </View>

      {image ? <EnlargedPhoto uri={image.uri} visible={isEnlarged} onClose={() => setEnlarged(false)} /> : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function StatusBadge({ result, field }: { result: ScanResult; field: ScanField }) {
  const { t } = useT();
  const value = result.fields[field];
  const hasConfidence = (SCANNED_MEDICATION_FIELDS as readonly string[]).includes(field);
  const uncertain = hasConfidence && isUncertain(result, field as (typeof SCANNED_MEDICATION_FIELDS)[number]);
  if (value === null) return <Badge label={t('scan.notOnLabel')} tone="neutral" icon="remove-circle-outline" />;
  if (uncertain) return <Badge label={t('scan.checkThis')} tone="warning" icon="alert-circle-outline" />;
  return <Badge label={t('scan.readFromLabel')} tone="success" icon="checkmark-circle-outline" />;
}

function NameBlock({ result, language }: { result: ScanResult; language: 'en' | 'ar' }) {
  const theme = useTheme();
  const { t } = useT();
  const shown = displayField(result, 'name', language);
  const printed = result.fields.name;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <AppText variant="label" color="textMuted" style={{ flex: 1 }}>
          {t('form.name').toUpperCase()}
        </AppText>
        <StatusBadge result={result} field="name" />
      </View>
      {shown ? (
        <AppText variant="display" selectable>
          {shown}
        </AppText>
      ) : (
        <AppText variant="title" color="textMuted" style={{ fontStyle: 'italic' }}>
          {t('scan.notIdentified')}
        </AppText>
      )}
      {shown && printed && shown !== printed ? (
        <AppText variant="body" color="textSecondary" selectable>
          {t('scan.printedAs', { text: printed })}
        </AppText>
      ) : null}
    </View>
  );
}

function FieldRow({
  label,
  field,
  result,
  language,
}: {
  label: string;
  field: ScanField;
  result: ScanResult;
  language: 'en' | 'ar';
}) {
  const theme = useTheme();
  const { t } = useT();
  const printed = result.fields[field];
  const shown = displayField(result, field, language);
  const display = field === 'expirationDate' && shown ? formatIsoDate(shown) : shown;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <AppText variant="label" color="textMuted" style={{ flex: 1 }}>
          {label.toUpperCase()}
        </AppText>
        <StatusBadge result={result} field={field} />
      </View>
      {display === null ? (
        <AppText variant="bodyLarge" color="textMuted" style={{ fontStyle: 'italic' }}>
          {t('common.couldNotBeDetermined')}
        </AppText>
      ) : (
        <AppText variant="heading" selectable style={{ fontWeight: '600' }}>
          {display}
        </AppText>
      )}
      {shown && printed && shown !== printed ? (
        <AppText variant="body" color="textSecondary" selectable>
          {t('scan.printedAs', { text: printed })}
        </AppText>
      ) : null}
    </View>
  );
}

function LabelPhoto({ uri, onPress, height }: { uri: string; onPress: () => void; height: number }) {
  const theme = useTheme();
  const { t } = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={t('scan.photo')}
      accessibilityHint={t('scan.enlargeHint')}
      style={{
        width: '100%',
        height,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </Pressable>
  );
}

function EnlargedPhoto({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useT();
  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          centerContent>
          <Image source={{ uri }} style={{ width: '100%', height: '100%', minHeight: 300 }} resizeMode="contain" accessibilityIgnoresInvertColors />
        </ScrollView>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('scan.close')}
          style={{
            position: 'absolute',
            top: 48,
            right: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: theme.radius.pill,
            paddingHorizontal: theme.spacing.base,
            minHeight: theme.touch.comfortable,
          }}>
          <Ionicons name="close" size={22} color="#000000" />
          <AppText variant="body" style={{ color: '#000000' }}>
            {t('scan.close')}
          </AppText>
        </Pressable>
      </View>
    </Modal>
  );
}
