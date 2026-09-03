/**
 * Schema migrations.
 *
 * Versioning uses SQLite's built-in `PRAGMA user_version`, an integer stored in
 * the database file itself. On launch we read it, apply every migration with a
 * higher version in order, and write the new version back. That means an
 * existing install upgrades in place instead of losing the user's medicines.
 *
 * RULES FOR ADDING A MIGRATION
 *   - append to the end of the array, never edit or renumber an existing entry
 *     (a released migration has already run on someone's phone)
 *   - one migration per schema change, with a descriptive name
 */

import type { SqlDatabase } from './types';

export type Migration = {
  version: number;
  name: string;
  /** SQL applied inside a transaction. May contain multiple statements. */
  up: string;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create_medications',
    up: `
      CREATE TABLE IF NOT EXISTS medications (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT NOT NULL,
        name            TEXT NOT NULL,
        dosage          TEXT,
        instructions    TEXT,
        expiration_date TEXT,
        frequency       TEXT,

        -- Enums are enforced by the database, not just by TypeScript, so bad
        -- data cannot get in through any other code path.
        safety_status   TEXT NOT NULL DEFAULT 'UNKNOWN'
                        CHECK (safety_status IN
                          ('SAFE','EXPIRING_SOON','EXPIRED','NEEDS_REVIEW','UNKNOWN')),
        source          TEXT NOT NULL DEFAULT 'MANUAL'
                        CHECK (source IN ('SCAN','MANUAL')),

        scan_confidence REAL,
        notes           TEXT,
        image_uri       TEXT,
        archived        INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      -- Every query is scoped by user_id, so it leads each index.
      CREATE INDEX IF NOT EXISTS idx_medications_user
        ON medications (user_id, archived);
      CREATE INDEX IF NOT EXISTS idx_medications_name
        ON medications (user_id, name);
      CREATE INDEX IF NOT EXISTS idx_medications_expiry
        ON medications (user_id, expiration_date);
    `,
  },
  // Milestone 5 adds version 2: the `reminders` and `doses` tables, with
  // FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE.
];

export const LATEST_SCHEMA_VERSION =
  MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1].version : 0;

/**
 * Bring the database up to the latest schema version.
 * Returns the version now in effect.
 */
export async function runMigrations(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  let currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.up);
    });

    // PRAGMA statements cannot take a bound parameter, so the version has to be
    // interpolated. It is safe because it is an integer literal from the array
    // above — never user input — but assert that before building the string.
    if (!Number.isInteger(migration.version)) {
      throw new Error(`Migration "${migration.name}" has a non-integer version.`);
    }
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);

    currentVersion = migration.version;
  }

  return currentVersion;
}
