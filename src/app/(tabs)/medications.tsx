/**
 * The Medicines tab: search, list, and the way in to adding one.
 *
 * Uses a FlatList rather than a scrolling column of cards so the list stays
 * smooth as it grows, and keeps the search field and the Add button pinned
 * outside it — a user should never have to scroll to reach either.
 *
 * FAMILY: the list shows ONE family member's medicines — the active member —
 * with a switcher at the top. The Add button carries that member's id, so a
 * medicine can only ever be saved under the person on screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { MemberSwitcher } from '@/components/family/MemberSwitcher';
import { MedicationCard } from '@/components/medication/MedicationCard';
import { AppText, Button, Card, InlineMessage, Screen, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { possessiveT, tCount } from '@/i18n/labels';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import {
  forMember,
  memberById,
  selectActiveMemberId,
  selectMembers,
  useFamilyStore,
} from '@/stores/useFamilyStore';
import {
  activeMedications,
  filterMedications,
  selectMedications,
  useMedicationStore,
} from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

export default function MedicationsScreen() {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const user = useAuthStore(selectUser);

  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const setActiveMember = useFamilyStore((state) => state.setActiveMember);
  const member = useMemo(() => memberById(members, activeMemberId), [members, activeMemberId]);

  const allMedications = useMedicationStore(selectMedications);
  const searchQuery = useMedicationStore((state) => state.searchQuery);
  const setSearchQuery = useMedicationStore((state) => state.setSearchQuery);
  const isLoading = useMedicationStore((state) => state.isLoading);
  const error = useMedicationStore((state) => state.error);
  const isPersistent = useMedicationStore((state) => state.isPersistent);

  // Derived in the component, not in a zustand selector — see the note in
  // useMedicationStore about snapshot stability.
  const mine = useMemo(
    () => activeMedications(forMember(allMedications, activeMemberId)),
    [allMedications, activeMemberId],
  );
  const visible = useMemo(() => filterMedications(mine, searchQuery), [mine, searchQuery]);

  const totalCount = mine.length;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <Screen padded={false}>
      <View
        style={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingTop: theme.spacing.base,
          gap: theme.spacing.base,
        }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">{member ? possessiveT(t, member, 'medicines') : t('medicines.title')}</AppText>
          <AppText variant="body" color="textSecondary">
            {totalCount === 0 ? t('medicines.nothingSaved') : tCount(t, 'medicines.saved', totalCount)}
          </AppText>
        </View>

        {members.length > 1 && user ? (
          <MemberSwitcher
            members={members}
            activeMemberId={activeMemberId}
            onSelect={(id) => void setActiveMember(user.id, id)}
          />
        ) : null}

        {member && !member.isSelf ? (
          <MemberContextBanner member={member} prefix={t('medicines.showingFor')} />
        ) : null}

        {!isPersistent ? (
          <InlineMessage
            tone="warning"
            title={t('medicines.notSavedTitle')}
            message={t('medicines.notSavedBody')}
          />
        ) : null}

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        {totalCount > 0 ? (
          <TextField
            label={t('medicines.search')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('medicines.searchPlaceholder')}
            autoCapitalize="none"
          />
        ) : null}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingTop: theme.spacing.base,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.md,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <MedicationCard
            medication={item}
            onPress={() => router.push({ pathname: '/medication/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          isLoading ? null : isSearching ? (
            <EmptyState
              icon="search-outline"
              title={t('medicines.noMatchesTitle')}
              body={t('medicines.noMatchesBody', { query: searchQuery.trim() })}
            />
          ) : (
            <EmptyState
              icon="medkit-outline"
              title={t('medicines.noneTitle')}
              body={
                member && !member.isSelf
                  ? t('medicines.noneBodyFor', { name: member.name })
                  : t('medicines.noneBody')
              }
            />
          )
        }
      />

      <View
        style={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: theme.spacing.base,
          paddingTop: theme.spacing.sm,
          // The bar shares the screen's background, so this rule is the only
          // thing separating it from the list — it needs the stronger token.
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderStrong,
          backgroundColor: theme.colors.background,
        }}>
        <Button
          label={member && !member.isSelf ? t('medicines.addFor', { name: member.name }) : t('medicines.add')}
          icon="add"
          size="large"
          onPress={() =>
            router.push({
              pathname: '/medication/add',
              params: member ? { memberId: member.id } : {},
            })
          }
          disabled={!user || !member}
        />
      </View>
    </Screen>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const theme = useTheme();

  return (
    <Card>
      <View
        style={{
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.lg,
        }}>
        <Ionicons name={icon} size={40} color={theme.colors.textMuted} />
        <AppText variant="subheading" align="center">
          {title}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {body}
        </AppText>
      </View>
    </Card>
  );
}
