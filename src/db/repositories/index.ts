/**
 * Repository factory.
 *
 * This is the only place that decides which data backend is in use:
 *
 *   phone   → SQLite (real database, indexes, CHECK constraints, migrations)
 *   browser → JSON store via localStorage
 *   SQLite failed to open → JSON store, with a warning, so the app still runs
 *
 * The same pattern as `services/auth`: one factory, an interface everywhere
 * else, and no screen that knows or cares which one it got.
 */

import { getDatabase, isSqliteSupported } from '../database';

import type { HealthConditionRepository } from './HealthConditionRepository';
import { JsonHealthConditionRepository } from './JsonHealthConditionRepository';
import { JsonMedicationRepository } from './JsonMedicationRepository';
import type { MedicationRepository } from './MedicationRepository';
import { SqliteHealthConditionRepository } from './SqliteHealthConditionRepository';
import { SqliteMedicationRepository } from './SqliteMedicationRepository';

let cached: MedicationRepository | null = null;
let cachedConditions: HealthConditionRepository | null = null;

/**
 * Same backend decision as medicines, so a medicine and the conditions it
 * links to are always in the same store.
 */
export async function getHealthConditionRepository(): Promise<HealthConditionRepository> {
  if (cachedConditions) return cachedConditions;

  const medications = await getMedicationRepository();
  if (medications.kind === 'sqlite') {
    cachedConditions = new SqliteHealthConditionRepository(await getDatabase());
  } else {
    cachedConditions = new JsonHealthConditionRepository();
  }
  return cachedConditions;
}

export async function getMedicationRepository(): Promise<MedicationRepository> {
  if (cached) return cached;

  if (isSqliteSupported()) {
    try {
      cached = new SqliteMedicationRepository(await getDatabase());
      return cached;
    } catch (error) {
      // A device where SQLite will not open is a broken install, but losing
      // the whole app is worse than losing durability, so degrade instead.
      console.warn(
        '[MediMind] SQLite could not be opened; falling back to JSON storage. ' +
          `Medicines may not be saved. Cause: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  cached = new JsonMedicationRepository();
  return cached;
}

/** Drop the cached repository. Used by tests. */
export function resetMedicationRepository(): void {
  cached = null;
  cachedConditions = null;
}

export type {
  MedicationRepository,
  MedicationRepositoryKind,
} from './MedicationRepository';
export type { HealthConditionRepository } from './HealthConditionRepository';
export { JsonMedicationRepository } from './JsonMedicationRepository';
export { SqliteMedicationRepository } from './SqliteMedicationRepository';
export { JsonHealthConditionRepository } from './JsonHealthConditionRepository';
export { SqliteHealthConditionRepository } from './SqliteHealthConditionRepository';
