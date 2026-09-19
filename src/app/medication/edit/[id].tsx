/**
 * Edit an existing medicine.
 *
 * Reuses MedicationForm, so the validation rules and the field order are
 * identical to the add screen by construction. A medicine never changes
 * owner: the banner names the family member it belongs to, and the health
 * conditions offered are that person's only.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { MedicationForm } from '@/components/medication/MedicationForm';
import { Button, InlineMessage, Screen } from '@/components/ui';
import type { HealthConditionInput } from '@/domain/healthCondition';
import { toFormValues, type MedicationInput } from '@/domain/medication';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { forMember, memberById, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export default function EditMedicationScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const user = useAuthStore(selectUser);
  const medication = useMedicationStore(
    (state) => state.medications.find((item) => item.id === id) ?? null,
  );
  const updateMedication = useMedicationStore((state) => state.updateMedication);
  const isSaving = useMedicationStore((state) => state.isSaving);
  const error = useMedicationStore((state) => state.error);

  const members = useFamilyStore(selectMembers);
  const member = useMemo(
    () => memberById(members, medication?.memberId),
    [members, medication],
  );

  const allConditions = useHealthConditionStore(selectConditions);
  const conditions = useMemo(
    () => forMember(allConditions, medication?.memberId ?? null),
    [allConditions, medication],
  );
  const createCondition = useHealthConditionStore((state) => state.createCondition);
  const isSavingCondition = useHealthConditionStore((state) => state.isSaving);
  const conditionError = useHealthConditionStore((state) => state.error);

  const handleSubmit = async (input: MedicationInput) => {
    if (!user || !medication) return;

    const updated = await updateMedication(user.id, medication.id, input);
    if (updated) router.back();
  };

  const handleCreateCondition = (input: HealthConditionInput) =>
    user && medication
      ? createCondition(user.id, { ...input, memberId: medication.memberId })
      : Promise.resolve(null);

  if (!user || !medication) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title={t('detail.notFoundTitle')}
            message={t('detail.notFoundEditing')}
          />
          <Button label={t('common.goBack')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.lg }}>
        {member ? <MemberContextBanner member={member} prefix={t('form.editingFor')} /> : null}
        <MedicationForm
          initialValues={toFormValues(medication)}
          submitLabel={t('common.saveChanges')}
          isSubmitting={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          error={error}
          conditions={conditions}
          onCreateCondition={handleCreateCondition}
          isSavingCondition={isSavingCondition}
          conditionError={conditionError}
          onManageConditions={() =>
            router.push({
              pathname: '/health/conditions',
              params: { memberId: medication.memberId ?? '' },
            })
          }
        />
      </View>
    </Screen>
  );
}
