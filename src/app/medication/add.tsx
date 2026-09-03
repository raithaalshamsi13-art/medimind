/**
 * Add a medicine by hand.
 *
 * PHASE 8: manual entry is not a fallback bolted on for when scanning fails —
 * it is a first-class path. Some labels are damaged, some medicines are
 * decanted into pill organisers, and some users would simply rather type.
 */

import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { MedicationForm } from '@/components/medication/MedicationForm';
import { InlineMessage, Screen } from '@/components/ui';
import { EMPTY_MEDICATION_FORM, type MedicationInput } from '@/domain/medication';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { useMedicationStore } from '@/stores/useMedicationStore';

export default function AddMedicationScreen() {
  const router = useRouter();
  const user = useAuthStore(selectUser);

  const createMedication = useMedicationStore((state) => state.createMedication);
  const isSaving = useMedicationStore((state) => state.isSaving);
  const error = useMedicationStore((state) => state.error);

  const handleSubmit = async (input: MedicationInput) => {
    if (!user) return;

    const created = await createMedication(user.id, input);
    if (created) {
      // Replace rather than push, so the back button does not return the user
      // to a form they have already submitted. The object form is required by
      // typed routes — a template literal is not assignable to the route union.
      router.replace({ pathname: '/medication/[id]', params: { id: created.id } });
    }
  };

  if (!user) {
    return (
      <Screen scroll>
        <InlineMessage
          tone="warning"
          message="You need to be signed in to add a medicine."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <View>
        <MedicationForm
          initialValues={EMPTY_MEDICATION_FORM}
          submitLabel="Save medicine"
          isSubmitting={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          error={error}
        />
      </View>
    </Screen>
  );
}
