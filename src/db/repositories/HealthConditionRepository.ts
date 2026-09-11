/**
 * Health-condition data access contract.
 *
 * Same rules as MedicationRepository: every method takes `userId`, every
 * implementation scopes by it, and screens depend only on this interface.
 *
 * Removing a condition also removes its links from medicines. In SQLite that
 * is `ON DELETE CASCADE`; the JSON fallback has to do it by hand — the shared
 * test suite checks both.
 */

import type { HealthCondition, HealthConditionInput } from '@/domain/healthCondition';
import type { Result } from '@/lib/result';

import type { MedicationRepositoryKind } from './MedicationRepository';

export type HealthConditionRepository = {
  readonly kind: MedicationRepositoryKind;

  /** All of one user's conditions, oldest first (the order they were added). */
  listForUser(userId: string): Promise<Result<HealthCondition[]>>;

  getById(userId: string, id: string): Promise<Result<HealthCondition | null>>;

  create(userId: string, input: HealthConditionInput): Promise<Result<HealthCondition>>;

  /** Fails with NOT_FOUND if absent for this user. */
  update(userId: string, id: string, input: HealthConditionInput): Promise<Result<HealthCondition>>;

  /** Permanently deletes, and unlinks it from every medicine. NOT_FOUND if absent. */
  remove(userId: string, id: string): Promise<Result<void>>;
};
