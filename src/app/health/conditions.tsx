/**
 * My health conditions — add, edit and remove the conditions the user keeps
 * track of. Reached from Settings and from the medicine form.
 *
 * Purely a notebook (see domain/healthCondition.ts): readings are shown as
 * typed and never interpreted.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { HealthConditionEditor } from '@/components/health/HealthConditionEditor';
import { AppText, Button, Card, InlineMessage, Screen } from '@/components/ui';
import {
  conditionDisplayName,
  EMPTY_CONDITION_FORM,
  toConditionFormValues,
  type HealthCondition,
  type HealthConditionInput,
} from '@/domain/healthCondition';
import { confirmAction } from '@/lib/confirm';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; condition: HealthCondition };

export default function HealthConditionsScreen() {
  const theme = useTheme();
  const user = useAuthStore(selectUser);

  const conditions = useHealthConditionStore(selectConditions);
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
        <InlineMessage tone="warning" message="You need to be signed in to see your conditions." />
      </Screen>
    );
  }

  const handleCreate = async (input: HealthConditionInput) => {
    const created = await createCondition(user.id, input);
    if (created) setMode({ kind: 'list' });
  };

  const handleUpdate = async (id: string, input: HealthConditionInput) => {
    const updated = await updateCondition(user.id, id, input);
    if (updated) setMode({ kind: 'list' });
  };

  const handleRemove = async (condition: HealthCondition) => {
    const confirmed = await confirmAction({
      title: `Remove ${conditionDisplayName(condition)}?`,
      message:
        'It will be unlinked from any medicines. The medicines themselves are not deleted.',
      confirmLabel: 'Remove',
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
        <AppText variant="body" color="textSecondary">
          Keep a note of long-term conditions and the latest readings you want to remember.
          MediMind stores them as you type them and does not interpret them.
        </AppText>

        {mode.kind === 'add' ? (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="heading">New condition</AppText>
              <HealthConditionEditor
                initialValues={EMPTY_CONDITION_FORM}
                submitLabel="Save condition"
                isSubmitting={isSaving}
                onSubmit={(input) => void handleCreate(input)}
                onCancel={() => setMode({ kind: 'list' })}
                error={error}
              />
            </View>
          </Card>
        ) : (
          <Button
            label="Add a condition"
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
                No conditions yet. Add one to link it to your medicines.
              </AppText>
            </View>
          </Card>
        ) : null}

        {conditions.map((condition) =>
          mode.kind === 'edit' && mode.condition.id === condition.id ? (
            <Card key={condition.id}>
              <View style={{ gap: theme.spacing.md }}>
                <AppText variant="heading">Edit condition</AppText>
                <HealthConditionEditor
                  initialValues={toConditionFormValues(condition)}
                  submitLabel="Save changes"
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

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="heart-outline" size={24} color={theme.colors.primary} />
          <AppText variant="subheading" style={{ flex: 1 }}>
            {conditionDisplayName(condition)}
          </AppText>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
            LATEST READING
          </AppText>
          <AppText variant="body" color={condition.reading ? 'text' : 'textMuted'}>
            {condition.reading ?? 'Not recorded'}
          </AppText>
        </View>

        {condition.notes ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textMuted">
              NOTES
            </AppText>
            <AppText variant="body">{condition.notes}</AppText>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Button
            label="Edit"
            icon="create-outline"
            variant="secondary"
            onPress={onEdit}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <Button
            label="Remove"
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
