/**
 * Add a medicine by hand.
 *
 * PHASE 8: manual entry is not a fallback bolted on for when scanning fails —
 * it is a first-class path. Some labels are damaged, some medicines are
 * decanted into pill organisers, and some users would simply rather type.
 *
 * FAMILY: the medicine is saved for one specific family member — the one
 * passed as `?memberId=`, or otherwise the member being managed. The banner
 * at the top names them, and there is no way to submit without a member.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { MedicationForm } from '@/components/medication/MedicationForm';
import { Button, InlineMessage, Screen } from '@/components/ui';
import type { HealthConditionInput } from '@/domain/healthCondition';
import { EMPTY_MEDICATION_FORM, type MedicationInput } from '@/domain/medication';
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

export default function AddMedicationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const user = useAuthStore(selectUser);

  const createMedication = useMedicationStore((state) => state.createMedication);
  const isSaving = useMedicationStore((state) => state.isSaving);
  const error = useMedicationStore((state) => state.error);

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const member = useMemo(
    () => memberById(members, memberId ?? activeMemberId),
    [members, memberId, activeMemberId],
  );

  const allConditions = useHealthConditionStore(selectConditions);
  const conditions = useMemo(
    () => forMember(allConditions, member?.id ?? null),
    [allConditions, member],
  );
  const createCondition = useHealthConditionStore((state) => state.createCondition);
  const isSavingCondition = useHealthConditionStore((state) => state.isSaving);
  const conditionError = useHealthConditionStore((state) => state.error);

  const handleSubmit = async (input: MedicationInput) => {
    if (!user || !member) return;

    const created = await createMedication(user.id, { ...input, memberId: member.id });
    if (created) {
      // CONFIRM → REMIND: a medicine that can be reminded about goes straight
      // to the reminder screen, pre-filled from its label, with "Not now" as
      // a way out. An expired medicine (blocked) or one whose wording gave no
      // suggestion still opens the reminder screen so the reason is explained.
      // Replace rather than push, so the back button does not return the user
      // to a form they have already submitted.
      router.replace({
        pathname: '/reminder/[medicationId]',
        params: { medicationId: created.id, new: '1' },
      });
    }
  };

  const handleCreateCondition = (input: HealthConditionInput) =>
    user && member
      ? createCondition(user.id, { ...input, memberId: member.id })
      : Promise.resolve(null);

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

  if (!member) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title="Who is this medicine for?"
            message="Choose a family member first, so the medicine is saved under the right person."
          />
          <Button label="Go to Family" icon="people-outline" onPress={() => router.push('/family')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <View style={{ gap: theme.spacing.lg }}>
        <MemberContextBanner
          member={member}
          prefix="Adding medicine for"
          onChange={() => router.push('/family')}
        />
        <MedicationForm
          initialValues={EMPTY_MEDICATION_FORM}
          submitLabel={`Save medicine for ${member.isSelf ? 'me' : member.name}`}
          isSubmitting={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          error={error}
          conditions={conditions}
          onCreateCondition={handleCreateCondition}
          isSavingCondition={isSavingCondition}
          conditionError={conditionError}
          onManageConditions={() =>
            router.push({ pathname: '/health/conditions', params: { memberId: member.id } })
          }
        />
      </View>
    </Screen>
  );
}
