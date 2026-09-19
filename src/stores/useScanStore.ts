/**
 * State for one scan: the photo, the reader's result, and where the flow is.
 *
 * SCAN → CHECK → CONFIRM, in one place:
 *   1. `run()` sends the photo to the scanner and validates the result
 *   2. `save()` builds the medicine, checks for a duplicate, saves it through
 *      the ordinary medication store (so the list updates and the safety
 *      engine runs), and remembers the new id so the result screen can link
 *      to it
 *
 * The photo is copied out of the camera cache into the app's document folder
 * before saving, so the medicine still has its picture after a restart.
 */

import { create } from 'zustand';

import {
  findDuplicate,
  needsNameConfirmation,
  scanToMedicationInput,
  type DemoScenario,
  type ScanResult,
} from '@/domain/scan';
import type { Medication } from '@/domain/medication';
import type { AppError } from '@/lib/errors';
import { appError, toAppError } from '@/lib/errors';
import { persistScanImage } from '@/lib/scanImage';
import { getScannerService, type ScanImage } from '@/services/scanner';

import { useMedicationStore } from './useMedicationStore';

export type ScanPhase = 'idle' | 'scanning' | 'reviewing' | 'saved' | 'failed';

type ScanState = {
  phase: ScanPhase;
  image: ScanImage | null;
  result: ScanResult | null;
  /** The id of the medicine that was created (or the duplicate that was found). */
  savedMedicationId: string | null;
  /** True when `save` stopped because the same medicine already exists. */
  duplicateOf: Pick<Medication, 'id' | 'name'> | null;
  error: AppError | null;
  isSaving: boolean;

  /** Read a photo. Uses the mock in Demo Mode. */
  run: (image: ScanImage, options: { demoMode: boolean; language: 'en' | 'ar'; demoScenario?: DemoScenario }) => Promise<void>;
  /**
   * Save the scanned medicine for `memberId`. Refuses when the name still
   * needs confirmation and none was given. `force` skips the duplicate check.
   */
  save: (
    userId: string,
    memberId: string,
    options?: { confirmedName?: string; force?: boolean },
  ) => Promise<Medication | null>;
  reset: () => void;
};

export const useScanStore = create<ScanState>((set, get) => ({
  phase: 'idle',
  image: null,
  result: null,
  savedMedicationId: null,
  duplicateOf: null,
  error: null,
  isSaving: false,

  run: async (image, options) => {
    set({ phase: 'scanning', image, result: null, error: null, savedMedicationId: null, duplicateOf: null });
    try {
      const scanner = getScannerService(options.demoMode);
      const result = await scanner.scan({ image, language: options.language, demoScenario: options.demoScenario });
      if (!result.ok) {
        set({ phase: 'failed', error: result.error });
        return;
      }
      set({ phase: 'reviewing', result: result.value });
    } catch (error) {
      set({ phase: 'failed', error: toAppError(error, 'ASSISTANT_UNAVAILABLE') });
    }
  },

  save: async (userId, memberId, options = {}) => {
    const { result, image } = get();
    if (!result) return null;
    if (needsNameConfirmation(result) && !options.confirmedName) {
      set({ error: appError('MISSING_FIELD') });
      return null;
    }

    set({ isSaving: true, error: null, duplicateOf: null });
    try {
      const medications = useMedicationStore.getState().medications;
      const name = options.confirmedName ?? result.fields.name ?? '';
      const duplicate = options.force ? null : findDuplicate(medications, name, memberId);
      if (duplicate) {
        set({ isSaving: false, duplicateOf: { id: duplicate.id, name: duplicate.name }, savedMedicationId: duplicate.id });
        return null;
      }

      const imageUri = image ? await persistScanImage(image) : null;
      const input = scanToMedicationInput(result, { memberId, confirmedName: options.confirmedName, imageUri });
      if (!input) {
        set({ isSaving: false, error: appError('MISSING_FIELD') });
        return null;
      }

      const created = await useMedicationStore.getState().createMedication(userId, input);
      if (!created) {
        set({ isSaving: false, error: useMedicationStore.getState().error ?? appError('DATABASE_ERROR') });
        return null;
      }
      set({ isSaving: false, phase: 'saved', savedMedicationId: created.id });
      return created;
    } catch (error) {
      set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
      return null;
    }
  },

  reset: () =>
    set({ phase: 'idle', image: null, result: null, savedMedicationId: null, duplicateOf: null, error: null, isSaving: false }),
}));
