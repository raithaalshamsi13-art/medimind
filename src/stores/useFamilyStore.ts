/**
 * Family state: the account's members and which one is being managed.
 *
 * `activeMemberId` is the single answer to "whose medicines am I looking
 * at?". Every medicine, condition and assistant screen reads it, and the
 * add-medicine screen writes the chosen member onto the new row. It is
 * remembered per account across launches so a carer who mostly manages one
 * relative is not reset to "Me" every time.
 */

import { create } from 'zustand';

import { getFamilyRepository } from '@/db/repositories';
import type { FamilyMember, FamilyMemberInput } from '@/domain/familyMember';
import type { AppError } from '@/lib/errors';
import { toAppError } from '@/lib/errors';
import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';

type ActiveByUser = Record<string, string>;

type FamilyState = {
  members: FamilyMember[];
  activeMemberId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: AppError | null;

  /** Ensures the "Me" profile exists, adopts older data, loads the list. */
  load: (userId: string, displayName: string) => Promise<void>;
  setActiveMember: (userId: string, memberId: string) => Promise<void>;
  createMember: (userId: string, input: FamilyMemberInput) => Promise<FamilyMember | null>;
  updateMember: (userId: string, id: string, input: FamilyMemberInput) => Promise<boolean>;
  /** Deletes the member and everything recorded for them. Caller confirms first. */
  removeMember: (userId: string, id: string) => Promise<boolean>;
  clearError: () => void;
  clear: () => void;
};

async function readActive(): Promise<ActiveByUser> {
  const stored = await readJson<ActiveByUser>(STORAGE_KEYS.activeFamilyMember);
  return stored.ok && stored.value && typeof stored.value === 'object' ? stored.value : {};
}

export const useFamilyStore = create<FamilyState>((set, get) => {
  const refresh = async (userId: string): Promise<FamilyMember[]> => {
    const repository = await getFamilyRepository();
    const result = await repository.listForUser(userId);
    if (!result.ok) {
      set({ error: result.error });
      return get().members;
    }
    set({ members: result.value });
    return result.value;
  };

  /** Keep the active id pointing at a member that still exists. */
  const settleActive = async (userId: string, members: FamilyMember[]): Promise<void> => {
    const self = members.find((m) => m.isSelf) ?? members[0] ?? null;
    const remembered = (await readActive())[userId];
    const current = get().activeMemberId;
    const candidate = [current, remembered].find((id) => id && members.some((m) => m.id === id));
    set({ activeMemberId: candidate ?? self?.id ?? null });
  };

  return {
    members: [],
    activeMemberId: null,
    isLoading: false,
    isSaving: false,
    error: null,

    load: async (userId, displayName) => {
      set({ isLoading: true, error: null });
      try {
        const repository = await getFamilyRepository();
        const self = await repository.ensureSelf(userId, displayName);
        if (!self.ok) {
          set({ isLoading: false, error: self.error });
          return;
        }
        const members = await refresh(userId);
        await settleActive(userId, members);
        set({ isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toAppError(error, 'DATABASE_ERROR') });
      }
    },

    setActiveMember: async (userId, memberId) => {
      if (!get().members.some((m) => m.id === memberId)) return;
      set({ activeMemberId: memberId });
      const active = await readActive();
      await writeJson(STORAGE_KEYS.activeFamilyMember, { ...active, [userId]: memberId });
    },

    createMember: async (userId, input) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getFamilyRepository();
        const result = await repository.create(userId, input);
        if (!result.ok) {
          set({ isSaving: false, error: result.error });
          return null;
        }
        await refresh(userId);
        set({ isSaving: false });
        return result.value;
      } catch (error) {
        set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
        return null;
      }
    },

    updateMember: async (userId, id, input) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getFamilyRepository();
        const result = await repository.update(userId, id, input);
        if (!result.ok) {
          set({ isSaving: false, error: result.error });
          return false;
        }
        await refresh(userId);
        set({ isSaving: false });
        return true;
      } catch (error) {
        set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
        return false;
      }
    },

    removeMember: async (userId, id) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getFamilyRepository();
        const result = await repository.remove(userId, id);
        if (!result.ok) {
          set({ isSaving: false, error: result.error });
          return false;
        }
        const members = await refresh(userId);
        await settleActive(userId, members);
        set({ isSaving: false });
        return true;
      } catch (error) {
        set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
        return false;
      }
    },

    clearError: () => set({ error: null }),

    clear: () =>
      set({ members: [], activeMemberId: null, error: null, isLoading: false, isSaving: false }),
  };
});

// ---------------------------------------------------------------------------
// Selectors (stable snapshots — see the note in useMedicationStore)
// ---------------------------------------------------------------------------

export const selectMembers = (state: FamilyState): FamilyMember[] => state.members;
export const selectActiveMemberId = (state: FamilyState): string | null => state.activeMemberId;

/** Plain helper — call inside `useMemo`, not as a zustand selector. */
export function memberById(members: FamilyMember[], id: string | null | undefined): FamilyMember | null {
  if (!id) return null;
  return members.find((m) => m.id === id) ?? null;
}

/** Everything belonging to one member. Plain helper for `useMemo`. */
export function forMember<T extends { memberId: string | null }>(rows: T[], memberId: string | null): T[] {
  if (!memberId) return [];
  return rows.filter((row) => row.memberId === memberId);
}
