/**
 * Add a family member. On success the new profile opens straight away so
 * the obvious next step — "add their medicines" — is one tap away.
 */

import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { FamilyMemberForm } from '@/components/family/FamilyMemberForm';
import { InlineMessage, Screen } from '@/components/ui';
import {
  emptyFamilyMemberForm,
  nextAvatarColor,
  type FamilyMemberInput,
} from '@/domain/familyMember';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import { selectMembers, useFamilyStore } from '@/stores/useFamilyStore';

export default function AddFamilyMemberScreen() {
  const router = useRouter();
  const user = useAuthStore(selectUser);

  const members = useFamilyStore(selectMembers);
  const createMember = useFamilyStore((state) => state.createMember);
  const isSaving = useFamilyStore((state) => state.isSaving);
  const error = useFamilyStore((state) => state.error);

  const handleSubmit = async (input: FamilyMemberInput) => {
    if (!user) return;
    const created = await createMember(user.id, input);
    if (created) {
      router.replace({ pathname: '/family/[id]', params: { id: created.id } });
    }
  };

  if (!user) {
    return (
      <Screen scroll>
        <InlineMessage tone="warning" message="You need to be signed in to add a family member." />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <View>
        <FamilyMemberForm
          initialValues={emptyFamilyMemberForm(nextAvatarColor(members))}
          isSelf={false}
          submitLabel="Add family member"
          isSubmitting={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          error={error}
        />
      </View>
    </Screen>
  );
}
