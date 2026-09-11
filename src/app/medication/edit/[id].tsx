/**
 * Edit an existing medicine.
 *
 * Reuses MedicationForm, so the validation rules and the field order are
 * identical to the add screen by construction.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { MedicationForm } from '@/components/medication/MedicationForm';
import { Button, InlineMessage, Screen } from '@/components/ui';
import type { HealthConditionInput } from '@/domain/healthCondition';
import { toFormValues, type MedicationInput } from '@/domain/medication';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

export default function EditMedicationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const user = useAuthStore(selectUser);
  const medication = useMedicationStore(
    (state) => state.medications.find((item) => item.id === id) ?? null,
  );
  const updateMedication = useMedicationStore((state) => state.updateMedication);
  const isSaving = useMedicationStore((state) => state.isSaving);
  const error = useMedicationStore((state) => state.error);

  const conditions = useHealthConditionStore(selectConditions);
  const createCondition = useHealthConditionStore((state) => state.createCondition);
  const isSavingCondition = useHealthConditionStore((state) => state.isSaving);
  const conditionError = useHealthConditionStore((state) => state.error);

  const handleSubmit = async (input: MedicationInput) => {
    if (!user || !medication) return;

    const updated = await updateMedication(user.id, medication.id, input);
    if (updated) router.back();
  };

  const handleCreateCondition = (input: HealthConditionInput) =>
    user ? createCondition(user.id, input) : Promise.resolve(null);

  if (!user || !medication) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title="Medicine not found"
            message="This medicine may have been deleted while you were editing it."
          />
          <Button label="Go back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <View>
        <MedicationForm
          initialValues={toFormValues(medication)}
          submitLabel="Save changes"
          isSubmitting={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          error={error}
          conditions={conditions}
          onCreateCondition={handleCreateCondition}
          isSavingCondition={isSavingCondition}
          conditionError={conditionError}
          onManageConditions={() => router.push('/health/conditions')}
        />
      </View>
    </Screen>
  );
}
