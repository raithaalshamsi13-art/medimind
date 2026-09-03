/**
 * Medication state.
 *
 * Screens call this store; the store calls the repository. No screen ever
 * touches SQL or knows which backend is in use.
 *
 * After every successful write the list is re-read from the repository rather
 * than patched in memory. With a handful of medicines that costs nothing, and
 * it guarantees the on-screen order always matches the database's
 * `ORDER BY name COLLATE NOCASE` instead of slowly drifting out of sync.
 */

import { create } from 'zustand';

import { getMedicationRepository, type MedicationRepositoryKind } from '@/db/repositories';
import type {
  Medication,
  MedicationCreateInput,
  MedicationInput,
} from '@/domain/medication';
import type { AppError } from '@/lib/errors';
import { toAppError } from '@/lib/errors';

type MedicationState = {
  medications: Medication[];
  isLoading: boolean;
  isSaving: boolean;
  error: AppError | null;
  /** Free-text filter applied by the Medicines screen. */
  searchQuery: string;
  /** Which repository answered — shown in Settings for transparency. */
  backend: MedicationRepositoryKind | null;
  /** False when medicines will be lost on restart (browser fallback). */
  isPersistent: boolean;

  load: (userId: string) => Promise<void>;
  createMedication: (
    userId: string,
    input: MedicationCreateInput,
  ) => Promise<Medication | null>;
  updateMedication: (
    userId: string,
    id: string,
    input: MedicationInput,
  ) => Promise<boolean>;
  removeMedication: (userId: string, id: string) => Promise<boolean>;

  setSearchQuery: (query: string) => void;
  clearError: () => void;
  /** Wipe in-memory state on sign-out. Stored data is left untouched. */
  clear: () => void;
};

export const useMedicationStore = create<MedicationState>((set, get) => {
  /** Re-read the list without flipping the main loading flag. */
  const refresh = async (userId: string): Promise<void> => {
    const repository = await getMedicationRepository();
    const result = await repository.listForUser(userId);
    if (result.ok) {
      set({ medications: result.value });
    } else {
      set({ error: result.error });
    }
  };

  return {
    medications: [],
    isLoading: false,
    isSaving: false,
    error: null,
    searchQuery: '',
    backend: null,
    isPersistent: true,

    load: async (userId) => {
      set({ isLoading: true, error: null });
      try {
        const repository = await getMedicationRepository();
        const result = await repository.listForUser(userId);

        if (!result.ok) {
          set({ isLoading: false, error: result.error });
          return;
        }
        set({
          medications: result.value,
          isLoading: false,
          backend: repository.kind,
          isPersistent: repository.isPersistent,
        });
      } catch (error) {
        set({ isLoading: false, error: toAppError(error, 'DATABASE_ERROR') });
      }
    },

    createMedication: async (userId, input) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getMedicationRepository();
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

    updateMedication: async (userId, id, input) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getMedicationRepository();
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

    removeMedication: async (userId, id) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getMedicationRepository();
        const result = await repository.remove(userId, id);

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

    setSearchQuery: (query) => set({ searchQuery: query }),

    clearError: () => set({ error: null }),

    clear: () =>
      set({
        medications: [],
        searchQuery: '',
        error: null,
        isLoading: false,
        isSaving: false,
      }),
  };
});

// ---------------------------------------------------------------------------
// Selectors and derivation helpers
//
// IMPORTANT: a zustand selector must return a value that is stable between
// renders when nothing has changed. Zustand v5 compares snapshots with
// Object.is, so a selector that builds a NEW array every call (e.g.
// `state.medications.filter(...)`) makes React think the store changed on every
// render — which triggers the "getSnapshot should be cached" warning and can
// loop. Selectors here therefore return primitives or the stored array itself;
// anything derived is a plain function meant to be wrapped in `useMemo`.
// ---------------------------------------------------------------------------

/** Safe selector: returns the stored array reference unchanged. */
export const selectMedications = (state: MedicationState): Medication[] => state.medications;

/** Safe selector: returns a primitive. */
export const selectMedicationCount = (state: MedicationState): number =>
  state.medications.reduce((count, medication) => (medication.archived ? count : count + 1), 0);

/** Plain helper — call inside `useMemo`, not as a zustand selector. */
export function activeMedications(medications: Medication[]): Medication[] {
  return medications.filter((medication) => !medication.archived);
}

/**
 * Search runs here rather than in SQL.
 *
 * A person has tens of medicines, not thousands, so filtering the already
 * loaded list is instant and — unlike a query per keystroke — cannot produce
 * flicker or a race between results arriving out of order.
 *
 * Plain helper: call inside `useMemo`.
 */
export function filterMedications(medications: Medication[], query: string): Medication[] {
  const needle = query.trim().toLowerCase();
  const active = activeMedications(medications);
  if (needle.length === 0) return active;

  return active.filter((medication) =>
    [
      medication.name,
      medication.dosage,
      medication.instructions,
      medication.frequency,
      medication.notes,
    ].some((field) => field?.toLowerCase().includes(needle)),
  );
}
