/**
 * Medication data access contract.
 *
 * SECURITY (Phase 4/18): every method takes `userId` and every implementation
 * MUST scope its query by it. A caller cannot ask for "medicine by id" without
 * also proving whose it is, so one user's data can never be returned to
 * another — the same guarantee Row Level Security gives us in Postgres, applied
 * to the on-device database.
 *
 * Screens depend on this interface, never on SQLite directly, which is what
 * lets the browser build run on a JSON store while the phone runs real SQLite.
 */

import type { Medication, MedicationCreateInput, MedicationInput } from '@/domain/medication';
import type { Result } from '@/lib/result';

export type MedicationRepositoryKind = 'sqlite' | 'json';

export type MedicationRepository = {
  /** Which backend is in use. Surfaced in Settings for transparency. */
  readonly kind: MedicationRepositoryKind;

  /** True when writes survive closing the app. */
  readonly isPersistent: boolean;

  /** Active (non-archived) medicines for one user, ordered by name. */
  listForUser(userId: string): Promise<Result<Medication[]>>;

  /** One medicine, or `null` when it does not exist for this user. */
  getById(userId: string, id: string): Promise<Result<Medication | null>>;

  create(userId: string, input: MedicationCreateInput): Promise<Result<Medication>>;

  /** Updates the user-editable fields. Fails with NOT_FOUND if absent. */
  update(userId: string, id: string, input: MedicationInput): Promise<Result<Medication>>;

  /** Permanently deletes. Fails with NOT_FOUND if absent. */
  remove(userId: string, id: string): Promise<Result<void>>;
};
