/**
 * Health conditions for one family member — add, edit and remove the
 * conditions they keep track of. Reached from Settings, the medicine form
 * and the family member's profile.
 *
 * Purely a notebook (see domain/healthCondition.ts): readings are shown as
 * typed and never interpreted.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { HealthConditionEditor } from '@/components/health/HealthConditionEditor';
import { AppText, Button, Card, InlineMessage, Screen } from '@/components/ui';
import {
  EMPTY_CONDITION_FORM,
  toConditionFormValues,
  type HealthCondition,
  type HealthConditionInput,
} from '@/domain/healthCondition';
import { useT } from '@/i18n';
import { conditionNameT } from '@/i18n/labels';
import { confirmAction } from '@/lib/confirm';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import {
  forMember,
  memberById,
  selectActiveMemberId,
  selectMembers,
  useFamilyStore,
} from '@/stores/useFamilyStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; condition: HealthCondition };

export default function HealthConditionsScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const user = useAuthStore(selectUser);

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const member = useMemo(
    () => memberById(members, memberId || activeMemberId),
    [members, memberId, activeMemberId],
  );

  const allConditions = useHealthConditionStore(selectConditions);
  const conditions = useMemo(
    () => forMember(allConditions, member?.id ?? null),
    [allConditions, member],
  );
  const isSaving = useHealthConditionStore((state) => state.isSaving);
  const error = useHealthConditionStore((state) => state.error);
  const createCondition = useHealthConditionStore((state) => state.createCondition);
  const updateCondition = useHealthConditionStore((state) => state.updateCondition);
  const removeCondition = useHealthConditionStore((state) => state.removeCondition);
  const reloadMedications = useMedicationStore((state) => state.load);

  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  if (!user) {
    return (
      <Screen scroll>
        <InlineMessage tone="warning" message={t('conditions.signIn')} />
      </Screen>
    );
  }

  if (!member) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title={t('conditions.whoseTitle')}
            message={t('conditions.whoseBody')}
          />
          <Button label={t('form.goToFamily')} icon="people-outline" onPress={() => router.push('/family')} />
        </View>
      </Screen>
    );
  }

  const handleCreate = async (input: HealthConditionInput) => {
    const created = await createCondition(user.id, { ...input, memberId: member.id });
    if (created) setMode({ kind: 'list' });
  };

  const handleUpdate = async (id: string, input: HealthConditionInput) => {
    const updated = await updateCondition(user.id, id, input);
    if (updated) setMode({ kind: 'list' });
  };

  const handleRemove = async (condition: HealthCondition) => {
    const confirmed = await confirmAction({
      title: t('conditions.removeTitle', { name: conditionNameT(t, condition) }),
      message: t('conditions.removeBody'),
      confirmLabel: t('common.remove'),
      destructive: true,
    });
    if (!confirmed) return;
    const removed = await removeCondition(user.id, condition.id);
    // Medicines carry the link ids, so re-read them to drop the removed one.
    if (removed) void reloadMedications(user.id);
  };

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.xl }}>
        <MemberContextBanner member={member} prefix={t('conditions.for')} />

        <AppText variant="body" color="textSecondary">
          {t('conditions.intro')}
        </AppText>

        {mode.kind === 'add' ? (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="heading">{t('conditions.new')}</AppText>
              <HealthConditionEditor
                initialValues={EMPTY_CONDITION_FORM}
                submitLabel={t('conditions.save')}
                isSubmitting={isSaving}
                onSubmit={(input) => void handleCreate(input)}
                onCancel={() => setMode({ kind: 'list' })}
                error={error}
              />
            </View>
          </Card>
        ) : (
          <Button
            label={t('conditions.add')}
            icon="add-circle-outline"
            onPress={() => setMode({ kind: 'add' })}
            disabled={mode.kind === 'edit'}
          />
        )}

        {conditions.length === 0 && mode.kind === 'list' ? (
          <Card>
            <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
              <Ionicons name="heart-outline" size={40} color={theme.colors.textMuted} />
              <AppText variant="body" color="textSecondary" align="center">
                {t('conditions.noneFor', {
                  name: member.isSelf ? t('conditions.you') : member.name,
                  their: member.isSelf ? t('conditions.your') : t('conditions.their'),
                })}
              </AppText>
            </View>
          </Card>
        ) : null}

        {conditions.map((condition) =>
          mode.kind === 'edit' && mode.condition.id === condition.id ? (
            <Card key={condition.id}>
              <View style={{ gap: theme.spacing.md }}>
                <AppText variant="heading">{t('conditions.editTitle')}</AppText>
                <HealthConditionEditor
                  initialValues={toConditionFormValues(condition)}
                  submitLabel={t('common.saveChanges')}
                  isSubmitting={isSaving}
                  onSubmit={(input) => void handleUpdate(condition.id, input)}
                  onCancel={() => setMode({ kind: 'list' })}
                  error={error}
                />
              </View>
            </Card>
          ) : (
            <ConditionCard
              key={condition.id}
              condition={condition}
              disabled={mode.kind !== 'list' || isSaving}
              onEdit={() => setMode({ kind: 'edit', condition })}
              onRemove={() => void handleRemove(condition)}
            />
          ),
        )}
      </View>
    </Screen>
  );
}

function ConditionCard({
  condition,
  disabled,
  onEdit,
  onRemove,
}: {
  condition: HealthCondition;
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { t } = useT();

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="heart-outline" size={24} color={theme.colors.primary} />
          <AppText variant="subheading" style={{ flex: 1 }}>
            {conditionNameT(t, condition)}
          </AppText>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
            {t('conditions.latestReading')}
          </AppText>
          <AppText variant="body" color={condition.reading ? 'text' : 'textMuted'}>
            {condition.reading ?? t('common.notRecorded')}
          </AppText>
        </View>

        {condition.notes ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textMuted">
              {t('conditions.notes')}
            </AppText>
            <AppText variant="body">{condition.notes}</AppText>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Button
            label={t('common.edit')}
            icon="create-outline"
            variant="secondary"
            onPress={onEdit}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <Button
            label={t('common.remove')}
            icon="trash-outline"
            variant="danger"
            onPress={onRemove}
            disabled={disabled}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Card>
  );
}
