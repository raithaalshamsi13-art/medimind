/**
 * Family-member data access contract.
 *
 * Same rules as the other repositories: every method takes `userId`, every
 * implementation scopes by it. Two behaviours are specific to this one:
 *
 *   - `ensureSelf` is how an account gets its "Me" profile. It is idempotent
 *     and, the first time it runs on an account that predates schema v3, it
 *     adopts every medicine and condition that has no member yet.
 *   - `remove` refuses to delete the self profile, and deleting any other
 *     member also deletes their medicines and conditions (cascade in SQLite,
 *     by hand in JSON). The caller is expected to have confirmed that.
 */

import type { FamilyMember, FamilyMemberInput } from '@/domain/familyMember';
import type { Result } from '@/lib/result';

import type { MedicationRepositoryKind } from './MedicationRepository';

export type FamilyRepository = {
  readonly kind: MedicationRepositoryKind;

  /** All members of one account: "Me" first, then in the order they were added. */
  listForUser(userId: string): Promise<Result<FamilyMember[]>>;

  getById(userId: string, id: string): Promise<Result<FamilyMember | null>>;

  /** Return the account holder's own profile, creating it if needed. */
  ensureSelf(userId: string, name: string): Promise<Result<FamilyMember>>;

  /** Adds a member. Refuses relationship ME — there is exactly one self. */
  create(userId: string, input: FamilyMemberInput): Promise<Result<FamilyMember>>;

  /** Edits a member. The self profile keeps relationship ME whatever is passed. */
  update(userId: string, id: string, input: FamilyMemberInput): Promise<Result<FamilyMember>>;

  /** Deletes a member and everything recorded for them. NOT_ALLOWED for self. */
  remove(userId: string, id: string): Promise<Result<void>>;
};
