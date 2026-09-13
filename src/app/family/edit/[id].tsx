/**
 * Edit a family member's profile (including your own "Me" profile).
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { FamilyMemberForm } from '@/components/family/FamilyMemberForm';
import { Button, InlineMessage, Screen } from '@/components/ui';
import { toFamilyMemberFormValues, type FamilyMemberInput } from '@/domain/familyMember';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { memberById, selectMembers, useFamilyStore } from '@/stores/useFamilyStore';
import { useTheme } from '@/theme/ThemeContext';

export default function EditFamilyMemberScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore(selectUser);

  const members = useFamilyStore(selectMembers);
  const member = useMemo(() => memberById(members, id), [members, id]);
  const updateMember = useFamilyStore((state) => state.updateMember);
  const isSaving = useFamilyStore((state) => state.isSaving);
  const error = useFamilyStore((state) => state.error);

  const handleSubmit = async (input: FamilyMemberInput) => {
    if (!user || !member) return;
    const updated = await updateMember(user.id, member.id, input);
    if (updated) router.back();
  };

  if (!user || !member) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.lg }}>
          <InlineMessage
            tone="warning"
            title="Family member not found"
            message="This profile may have been removed."
          />
          <Button label="Go back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <View>
        <FamilyMemberForm
          initialValues={toFamilyMemberFormValues(member)}
          isSelf={member.isSelf}
          submitLabel="Save changes"
          isSubmitting={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          error={error}
        />
      </View>
    </Screen>
  );
}
