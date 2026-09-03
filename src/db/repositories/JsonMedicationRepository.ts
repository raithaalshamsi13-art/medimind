/**
 * JSON fallback implementation.
 *
 * WHY IT EXISTS
 * `expo-sqlite` cannot be used in the browser (web support is alpha in SDK 57
 * and needs WASM plus COOP/COEP headers). Without this, every medication screen
 * would be dead in the browser — and the browser is a useful place to work on
 * UI quickly.
 *
 * It stores all medicines as one JSON array through `lib/storage`, which itself
 * picks localStorage on web. Behaviour matches the SQLite repository exactly,
 * including per-user isolation and NOT_FOUND semantics, so the same test suite
 * runs against both.
 *
 * It is NOT a substitute for the real database: no indexes, no constraints, and
 * the whole array is rewritten on every change. That is fine for a browser
 * preview holding a handful of medicines, and it is never used on the phone.
 */

import type {
  Medication,
  MedicationCreateInput,
  MedicationInput,
} from '@/domain/medication';
import { isoNow } from '@/lib/datetime';
import { appError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';
import { isStoragePersistent, readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';

import type { MedicationRepository } from './MedicationRepository';

export class JsonMedicationRepository implements MedicationRepository {
  readonly kind = 'json' as const;

  /** Depends on whether the storage layer found a durable backend. */
  get isPersistent(): boolean {
    return isStoragePersistent();
  }

  private async readAll(): Promise<Result<Medication[]>> {
    const stored = await readJson<Medication[]>(STORAGE_KEYS.medications);
    if (!stored.ok) return fail(stored.error);
    return ok(Array.isArray(stored.value) ? stored.value : []);
  }

  private async writeAll(medications: Medication[]): Promise<Result<void>> {
    return writeJson(STORAGE_KEYS.medications, medications);
  }

  async listForUser(userId: string): Promise<Result<Medication[]>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const mine = all.value
      .filter((medication) => medication.userId === userId && !medication.archived)
      // Match the SQL's `ORDER BY name COLLATE NOCASE ASC`.
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return ok(mine);
  }

  async getById(userId: string, id: string): Promise<Result<Medication | null>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const found = all.value.find(
      (medication) => medication.id === id && medication.userId === userId,
    );
    return ok(found ?? null);
  }

  async create(userId: string, input: MedicationCreateInput): Promise<Result<Medication>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const now = isoNow();
    const medication: Medication = {
      id: newId(),
      userId,
      name: input.name,
      dosage: input.dosage,
      instructions: input.instructions,
      expirationDate: input.expirationDate,
      frequency: input.frequency,
      // Only MedicationSafetyService (Milestone 4) may set this.
      safetyStatus: 'UNKNOWN',
      source: input.source ?? 'MANUAL',
      scanConfidence: input.scanConfidence ?? null,
      notes: input.notes,
      imageUri: input.imageUri ?? null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.writeAll([...all.value, medication]);
    if (!saved.ok) return fail(saved.error);
    return ok(medication);
  }

  async update(
    userId: string,
    id: string,
    input: MedicationInput,
  ): Promise<Result<Medication>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const index = all.value.findIndex(
      (medication) => medication.id === id && medication.userId === userId,
    );
    if (index === -1) return fail(appError('NOT_FOUND'));

    const updated: Medication = {
      ...all.value[index],
      name: input.name,
      dosage: input.dosage,
      instructions: input.instructions,
      expirationDate: input.expirationDate,
      frequency: input.frequency,
      notes: input.notes,
      updatedAt: isoNow(),
    };

    const next = [...all.value];
    next[index] = updated;

    const saved = await this.writeAll(next);
    if (!saved.ok) return fail(saved.error);
    return ok(updated);
  }

  async remove(userId: string, id: string): Promise<Result<void>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const next = all.value.filter(
      (medication) => !(medication.id === id && medication.userId === userId),
    );
    if (next.length === all.value.length) return fail(appError('NOT_FOUND'));

    return this.writeAll(next);
  }
}
