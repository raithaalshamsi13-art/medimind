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
import { persistScanImage, prepareScanImage } from '@/lib/scanImage';
import { getScannerService, MAX_SCAN_PHOTOS, type ScanImage } from '@/services/scanner';

import { useMedicationStore } from './useMedicationStore';

export type ScanPhase = 'idle' | 'scanning' | 'reviewing' | 'saved' | 'failed';

type ScanState = {
  phase: ScanPhase;
  /** The photos of this one medicine, in the order they were taken. The first is kept with the medicine. */
  images: ScanImage[];
  /** The first photo — what older screens and the save path use. */
  image: ScanImage | null;
  result: ScanResult | null;
  /** The id of the medicine that was created (or the duplicate that was found). */
  savedMedicationId: string | null;
  /** True when `save` stopped because the same medicine already exists. */
  duplicateOf: Pick<Medication, 'id' | 'name'> | null;
  error: AppError | null;
  isSaving: boolean;

  /** Read one medicine from one or more photos. Uses the mock in Demo Mode. */
  run: (
    images: ScanImage | ScanImage[],
    options: { demoMode: boolean; language: 'en' | 'ar'; demoScenario?: DemoScenario },
  ) => Promise<void>;
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
  images: [],
  image: null,
  result: null,
  savedMedicationId: null,
  duplicateOf: null,
  error: null,
  isSaving: false,

  run: async (input, options) => {
    const chosen = (Array.isArray(input) ? input : [input]).slice(0, MAX_SCAN_PHOTOS);
    set({ phase: 'scanning', images: chosen, image: chosen[0] ?? null, result: null, error: null, savedMedicationId: null, duplicateOf: null });
    try {
      const scanner = getScannerService(options.demoMode);
      // Shrink multi-megabyte camera photos before they travel; the resized
      // copies are also what the screen shows and the first is kept with the
      // medicine. The same photo chosen twice is sent once.
      const prepared: ScanImage[] = [];
      const seen = new Set<string>();
      for (const image of chosen) {
        const ready = scanner.kind === 'mock' ? image : await prepareScanImage(image);
        const key = ready.base64.length + ':' + ready.base64.slice(0, 64) + ready.base64.slice(-64);
        if (seen.has(key)) continue;
        seen.add(key);
        prepared.push(ready);
      }
      set({ images: prepared, image: prepared[0] ?? null });
      const result = await scanner.scan({ images: prepared, language: options.language, demoScenario: options.demoScenario });
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
    set({ phase: 'idle', images: [], image: null, result: null, savedMedicationId: null, duplicateOf: null, error: null, isSaving: false }),
}));
