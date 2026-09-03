/**
 * The Medicines tab: search, list, and the way in to adding one.
 *
 * Uses a FlatList rather than a scrolling column of cards so the list stays
 * smooth as it grows, and keeps the search field and the Add button pinned
 * outside it — a user should never have to scroll to reach either.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { MedicationCard } from '@/components/medication/MedicationCard';
import { AppText, Button, Card, InlineMessage, Screen, TextField } from '@/components/ui';
import { selectUser, useAuthStore } from '@/stores/useAuthStore';
import {
  filterMedications,
  selectMedicationCount,
  selectMedications,
  useMedicationStore,
} from '@/stores/useMedicationStore';
import { useTheme } from '@/theme/ThemeContext';

export default function MedicationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore(selectUser);

  const medications = useMedicationStore(selectMedications);
  const totalCount = useMedicationStore(selectMedicationCount);
  const searchQuery = useMedicationStore((state) => state.searchQuery);
  const setSearchQuery = useMedicationStore((state) => state.setSearchQuery);
  const isLoading = useMedicationStore((state) => state.isLoading);
  const error = useMedicationStore((state) => state.error);
  const isPersistent = useMedicationStore((state) => state.isPersistent);

  // Derived in the component, not in a zustand selector — see the note in
  // useMedicationStore about snapshot stability.
  const visible = useMemo(
    () => filterMedications(medications, searchQuery),
    [medications, searchQuery],
  );

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
          <AppText variant="title">Medicines</AppText>
          <AppText variant="body" color="textSecondary">
            {totalCount === 0
              ? 'Nothing saved yet'
              : `${totalCount} ${totalCount === 1 ? 'medicine' : 'medicines'} saved`}
          </AppText>
        </View>

        {!isPersistent ? (
          <InlineMessage
            tone="warning"
            title="Not being saved"
            message="Medicines added here will be lost when you close the app, because this device gave MediMind no permanent storage. Open MediMind on your phone to save them."
          />
        ) : null}

        {error ? <InlineMessage tone="danger" message={error.message} /> : null}

        {totalCount > 0 ? (
          <TextField
            label="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, dose or instructions"
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
              title="No matches"
              body={`Nothing matches “${searchQuery.trim()}”. Try a shorter search, or check the spelling.`}
            />
          ) : (
            <EmptyState
              icon="medkit-outline"
              title="No medicines yet"
              body="Add your first medicine by hand, or scan its label once scanning is available."
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
          label="Add medicine"
          icon="add"
          size="large"
          onPress={() => router.push('/medication/add')}
          disabled={!user}
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
