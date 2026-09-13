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

import type { FamilyRepository } from './FamilyRepository';
import type { HealthConditionRepository } from './HealthConditionRepository';
import { JsonFamilyRepository } from './JsonFamilyRepository';
import { JsonHealthConditionRepository } from './JsonHealthConditionRepository';
import { JsonMedicationRepository } from './JsonMedicationRepository';
import type { MedicationRepository } from './MedicationRepository';
import { JsonDoseRepository, JsonReminderRepository } from './JsonReminderRepository';
import type { DoseRepository, ReminderRepository } from './ReminderRepository';
import { SqliteFamilyRepository } from './SqliteFamilyRepository';
import { SqliteHealthConditionRepository } from './SqliteHealthConditionRepository';
import { SqliteMedicationRepository } from './SqliteMedicationRepository';
import { SqliteDoseRepository, SqliteReminderRepository } from './SqliteReminderRepository';

let cached: MedicationRepository | null = null;
let cachedConditions: HealthConditionRepository | null = null;
let cachedFamily: FamilyRepository | null = null;
let cachedReminders: ReminderRepository | null = null;
let cachedDoses: DoseRepository | null = null;

export async function getReminderRepository(): Promise<ReminderRepository> {
  if (cachedReminders) return cachedReminders;
  const medications = await getMedicationRepository();
  cachedReminders =
    medications.kind === 'sqlite'
      ? new SqliteReminderRepository(await getDatabase())
      : new JsonReminderRepository();
  return cachedReminders;
}

export async function getDoseRepository(): Promise<DoseRepository> {
  if (cachedDoses) return cachedDoses;
  const medications = await getMedicationRepository();
  cachedDoses =
    medications.kind === 'sqlite'
      ? new SqliteDoseRepository(await getDatabase())
      : new JsonDoseRepository();
  return cachedDoses;
}

/** Same backend as medicines, so members and their data share one store. */
export async function getFamilyRepository(): Promise<FamilyRepository> {
  if (cachedFamily) return cachedFamily;

  const medications = await getMedicationRepository();
  if (medications.kind === 'sqlite') {
    cachedFamily = new SqliteFamilyRepository(await getDatabase());
  } else {
    cachedFamily = new JsonFamilyRepository();
  }
  return cachedFamily;
}

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
  cachedFamily = null;
  cachedReminders = null;
  cachedDoses = null;
}

export type {
  MedicationRepository,
  MedicationRepositoryKind,
} from './MedicationRepository';
export type { HealthConditionRepository } from './HealthConditionRepository';
export type { FamilyRepository } from './FamilyRepository';
export type { DoseRepository, DoseSeed, ReminderRepository } from './ReminderRepository';
export { JsonDoseRepository, JsonReminderRepository } from './JsonReminderRepository';
export { SqliteDoseRepository, SqliteReminderRepository } from './SqliteReminderRepository';
export { JsonFamilyRepository } from './JsonFamilyRepository';
export { SqliteFamilyRepository } from './SqliteFamilyRepository';
export { JsonMedicationRepository } from './JsonMedicationRepository';
export { SqliteMedicationRepository } from './SqliteMedicationRepository';
export { JsonHealthConditionRepository } from './JsonHealthConditionRepository';
export { SqliteHealthConditionRepository } from './SqliteHealthConditionRepository';
