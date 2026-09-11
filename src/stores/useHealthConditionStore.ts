/**
 * Health-condition state. Same shape and rules as useMedicationStore: screens
 * call the store, the store calls the repository, and the list is re-read
 * after every write.
 *
 * Conditions are never passed to the assistant — see domain/healthCondition.ts.
 */

import { create } from 'zustand';

import { getHealthConditionRepository } from '@/db/repositories';
import type { HealthCondition, HealthConditionInput } from '@/domain/healthCondition';
import type { AppError } from '@/lib/errors';
import { toAppError } from '@/lib/errors';

type HealthConditionState = {
  conditions: HealthCondition[];
  isLoading: boolean;
  isSaving: boolean;
  error: AppError | null;

  load: (userId: string) => Promise<void>;
  createCondition: (userId: string, input: HealthConditionInput) => Promise<HealthCondition | null>;
  updateCondition: (userId: string, id: string, input: HealthConditionInput) => Promise<boolean>;
  removeCondition: (userId: string, id: string) => Promise<boolean>;
  clearError: () => void;
  clear: () => void;
};

export const useHealthConditionStore = create<HealthConditionState>((set) => {
  const refresh = async (userId: string): Promise<void> => {
    const repository = await getHealthConditionRepository();
    const result = await repository.listForUser(userId);
    if (result.ok) set({ conditions: result.value });
    else set({ error: result.error });
  };

  return {
    conditions: [],
    isLoading: false,
    isSaving: false,
    error: null,

    load: async (userId) => {
      set({ isLoading: true, error: null });
      try {
        await refresh(userId);
        set({ isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toAppError(error, 'DATABASE_ERROR') });
      }
    },

    createCondition: async (userId, input) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getHealthConditionRepository();
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

    updateCondition: async (userId, id, input) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getHealthConditionRepository();
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

    removeCondition: async (userId, id) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getHealthConditionRepository();
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

    clearError: () => set({ error: null }),

    clear: () => set({ conditions: [], error: null, isLoading: false, isSaving: false }),
  };
});

/** Safe selector: the stored array reference, unchanged. */
export const selectConditions = (state: HealthConditionState): HealthCondition[] =>
  state.conditions;
