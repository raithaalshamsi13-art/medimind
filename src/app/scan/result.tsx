/**
 * CHECK → CONFIRM — what the reader found, side by side with the photo.
 *
 * Layout: on a wide screen the photo sits beside the label text; on a phone
 * they stack. The text panel is exactly what was read, selectable and
 * scrollable, so the user can compare it with the pack. Under it, the fields
 * MediMind picked out, each marked "Read from label" or "Check this" (read
 * with low confidence) or "Not on the label".
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
import { AppText, Badge, Button, Card, InlineMessage, Screen, TextField } from '@/components/ui';
import {
  isUncertain,
  needsNameConfirmation,
  SCANNED_MEDICATION_FIELDS,
  type ScanField,
  type ScanResult,
} from '@/domain/scan';
import { useT } from '@/i18n';
import { localizeMessage } from '@/i18n/labels';
import { formatIsoDate } from '@/lib/datetime';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { memberById, selectActiveMemberId, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useScanStore } from '@/stores/useScanStore';
import { useTheme } from '@/theme/ThemeContext';

/** Photo and text sit side by side from this width up. */
const SIDE_BY_SIDE_MIN_WIDTH = 720;

export default function ScanResultScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const sideBySide = width >= SIDE_BY_SIDE_MIN_WIDTH;

  const user = useAuthStore(selectUser);
  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const member = useMemo(() => memberById(members, activeMemberId), [members, activeMemberId]);

  const phase = useScanStore((state) => state.phase);
  const image = useScanStore((state) => state.image);
  const result = useScanStore((state) => state.result);
  const error = useScanStore((state) => state.error);
  const isSaving = useScanStore((state) => state.isSaving);
  const duplicateOf = useScanStore((state) => state.duplicateOf);
  const savedMedicationId = useScanStore((state) => state.savedMedicationId);
  const save = useScanStore((state) => state.save);
  const reset = useScanStore((state) => state.reset);

  const saved = useMedicationStore((state) =>
    savedMedicationId ? (state.medications.find((m) => m.id === savedMedicationId) ?? null) : null,
  );

  const [confirmedName, setConfirmedName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isEnlarged, setEnlarged] = useState(false);

  // Auto-add: once the reading is in and the name is trustworthy, save it —
  // once. `useRef` so a re-render never triggers a second save.
  const autoSaved = useRef(false);
  useEffect(() => {
    if (phase !== 'reviewing' || !result || !user || !member || autoSaved.current) return;
    if (needsNameConfirmation(result)) return;
    autoSaved.current = true;
    void save(user.id, member.id);
  }, [phase, result, user, member, save]);

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

  const retake = () => {
    reset();
    router.back();
  };
  const scanAnother = () => {
    reset();
    router.replace('/scan');
  };
  const enterManually = () => {
    reset();
    router.replace({ pathname: '/medication/add', params: member ? { memberId: member.id } : {} });
  };
  const finish = () => {
    reset();
    router.replace('/medications');
  };

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
          <AppText variant="body" color="textSecondary" align="center">
            {t('scan.readingBody')}
          </AppText>
        </View>
        {image ? <EnlargedPhoto uri={image.uri} visible={isEnlarged} onClose={() => setEnlarged(false)} /> : null}
      </Screen>
    );
  }

  // ---- Failed --------------------------------------------------------------
  if (phase === 'failed' || !result) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="danger"
            title={t('scan.failedTitle')}
            message={error ? localizeMessage(error.message) : t('scan.notReadable')}
          />
          <Button label={t('scan.retake')} icon="camera-outline" onPress={retake} />
          <Button label={t('scan.enterManually')} icon="create-outline" variant="secondary" onPress={enterManually} />
        </View>
      </Screen>
    );
  }

  const nameNeeded = needsNameConfirmation(result);
  const nothingRead = result.rawText.trim().length === 0 && SCANNED_MEDICATION_FIELDS.every((f) => result.fields[f] === null);
  const memberName = member?.name ?? '';

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.xl }}>
        {member && !member.isSelf ? <MemberContextBanner member={member} prefix={t('scan.scanningFor')} /> : null}

        {/* ---------- Outcome ---------- */}
        {phase === 'saved' && saved ? (
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
              onPress={() => {
                reset();
                router.replace({ pathname: '/medication/[id]', params: { id: saved.id } });
              }}
            />
            {saved.safetyStatus === 'EXPIRED' ? null : (
              <Button
                label={t('scan.setReminder')}
                icon="alarm-outline"
                variant="secondary"
                onPress={() => {
                  reset();
                  router.replace({ pathname: '/reminder/[medicationId]', params: { medicationId: saved.id, new: '1' } });
                }}
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
              onPress={() => {
                reset();
                router.replace({ pathname: '/medication/[id]', params: { id: duplicateOf.id } });
              }}
            />
            <Button label={t('scan.saveAnyway')} icon="add" variant="secondary" onPress={saveAnyway} loading={isSaving} />
            <Button label={t('scan.scanAnother')} icon="camera-outline" variant="ghost" onPress={scanAnother} />
          </View>
        ) : isSaving || (!nameNeeded && phase === 'reviewing' && !error) ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <ActivityIndicator color={theme.colors.primary} />
              <AppText variant="body" color="textSecondary">
                {t('scan.adding')}
              </AppText>
            </View>
          </Card>
        ) : nameNeeded ? (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              {nothingRead ? <InlineMessage tone="warning" message={t('scan.notReadable')} /> : null}
              <AppText variant="heading">{t('scan.confirmNameTitle')}</AppText>
              <AppText variant="body" color="textSecondary">
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
        ) : null}

        {/* ---------- Photo + label text ---------- */}
        <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: theme.spacing.lg }}>
          <View style={{ flex: sideBySide ? 1 : undefined, gap: theme.spacing.sm }}>
            <AppText variant="label" color="textMuted">
              {t('scan.photo').toUpperCase()}
            </AppText>
            {image ? (
              <>
                <LabelPhoto uri={image.uri} onPress={() => setEnlarged(true)} height={sideBySide ? 360 : 240} />
                <AppText variant="caption" color="textMuted" align="center">
                  {t('scan.tapToEnlarge')}
                </AppText>
              </>
            ) : null}
          </View>

          <View style={{ flex: sideBySide ? 1.2 : undefined, gap: theme.spacing.sm }}>
            <AppText variant="label" color="textMuted">
              {t('scan.textTitle').toUpperCase()}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('scan.textBody')}
            </AppText>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.borderStrong,
                borderRadius: theme.radius.lg,
                maxHeight: sideBySide ? 360 : 260,
              }}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: sideBySide ? 360 : 260 }} contentContainerStyle={{ padding: theme.spacing.base }}>
                {result.rawText.trim().length > 0 ? (
                  <AppText variant="body" selectable style={{ fontFamily: 'monospace', lineHeight: 24 }}>
                    {result.rawText}
                  </AppText>
                ) : (
                  <AppText variant="body" color="textMuted" style={{ fontStyle: 'italic' }}>
                    {t('scan.noText')}
                  </AppText>
                )}
              </ScrollView>
            </View>
          </View>
        </View>

        {/* ---------- Warnings from the reader ---------- */}
        {result.warnings.length > 0 ? (
          <InlineMessage tone="warning" title={t('scan.warnings')} message={result.warnings.join('\n')} />
        ) : null}

        {/* ---------- Picked-out fields ---------- */}
        <Card>
          <View style={{ gap: theme.spacing.lg }}>
            <AppText variant="label" color="textMuted">
              {t('scan.fieldsTitle').toUpperCase()}
            </AppText>
            <FieldRow label={t('form.name')} field="name" result={result} />
            <FieldRow label={t('detail.dosage')} field="dosage" result={result} />
            <FieldRow label={t('detail.howOften')} field="frequency" result={result} />
            <FieldRow label={t('detail.instructions')} field="instructions" result={result} />
            <FieldRow label={t('detail.expiryDate')} field="expirationDate" result={result} />
            <FieldRow label={t('scan.activeIngredients')} field="activeIngredients" result={result} />
            <FieldRow label={t('scan.manufacturer')} field="manufacturer" result={result} />
          </View>
        </Card>

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

function FieldRow({ label, field, result }: { label: string; field: ScanField; result: ScanResult }) {
  const theme = useTheme();
  const { t } = useT();
  const value = result.fields[field];
  const hasConfidence = (SCANNED_MEDICATION_FIELDS as readonly string[]).includes(field);
  const uncertain = hasConfidence && isUncertain(result, field as (typeof SCANNED_MEDICATION_FIELDS)[number]);
  const display = field === 'expirationDate' && value ? formatIsoDate(value) : value;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <AppText variant="label" color="textMuted" style={{ flex: 1 }}>
          {label.toUpperCase()}
        </AppText>
        {value === null ? (
          <Badge label={t('scan.notOnLabel')} tone="neutral" icon="remove-circle-outline" />
        ) : uncertain ? (
          <Badge label={t('scan.checkThis')} tone="warning" icon="alert-circle-outline" />
        ) : (
          <Badge label={t('scan.readFromLabel')} tone="success" icon="checkmark-circle-outline" />
        )}
      </View>
      {display === null ? (
        <AppText variant="body" color="textMuted" style={{ fontStyle: 'italic' }}>
          {t('common.couldNotBeDetermined')}
        </AppText>
      ) : (
        <AppText variant="bodyLarge" selectable>
          {display}
        </AppText>
      )}
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
