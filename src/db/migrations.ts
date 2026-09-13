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
  {
    version: 2,
    name: 'structured_fields_and_health_conditions',
    up: `
      -- Chosen-from-a-list fields on a medicine. Nullable: an existing row,
      -- or a scanned label, may simply not say.
      ALTER TABLE medications ADD COLUMN kind TEXT
        CHECK (kind IS NULL OR kind IN ('PRESCRIPTION','OTC','SUPPLEMENT'));
      ALTER TABLE medications ADD COLUMN form TEXT
        CHECK (form IS NULL OR form IN
          ('TABLET','CAPSULE','LIQUID','INHALER','INJECTION','CREAM','DROPS','PATCH','SPRAY','OTHER'));

      -- The user's long-term conditions. Organisational only: stored and
      -- shown as typed, never interpreted (see src/domain/healthCondition.ts).
      CREATE TABLE IF NOT EXISTS health_conditions (
        id          TEXT PRIMARY KEY NOT NULL,
        user_id     TEXT NOT NULL,
        type        TEXT NOT NULL
                    CHECK (type IN ('HIGH_BLOOD_PRESSURE','DIABETES','LOW_BLOOD_SUGAR','ASTHMA',
                      'HIGH_CHOLESTEROL','HEART','THYROID','KIDNEY','ARTHRITIS','OTHER')),
        custom_name TEXT,
        reading     TEXT,
        notes       TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_health_conditions_user
        ON health_conditions (user_id, created_at);

      -- Which medicines the user linked to which conditions. Deleting either
      -- side removes the link (foreign_keys is ON for every connection).
      CREATE TABLE IF NOT EXISTS medication_conditions (
        medication_id TEXT NOT NULL REFERENCES medications (id) ON DELETE CASCADE,
        condition_id  TEXT NOT NULL REFERENCES health_conditions (id) ON DELETE CASCADE,
        user_id       TEXT NOT NULL,
        PRIMARY KEY (medication_id, condition_id)
      );
      CREATE INDEX IF NOT EXISTS idx_medication_conditions_user
        ON medication_conditions (user_id, condition_id);
    `,
  },
  {
    version: 3,
    name: 'family_members',
    up: `
      -- Profiles managed under one account (no separate login). Exactly one
      -- row per account has is_self = 1: the account holder ("Me").
      CREATE TABLE IF NOT EXISTS family_members (
        id                  TEXT PRIMARY KEY NOT NULL,
        user_id             TEXT NOT NULL,
        name                TEXT NOT NULL,
        relationship        TEXT NOT NULL
                            CHECK (relationship IN ('ME','MOTHER','FATHER','SPOUSE','SON',
                              'DAUGHTER','GRANDMOTHER','GRANDFATHER','OTHER')),
        custom_relationship TEXT,
        date_of_birth       TEXT,
        avatar_color        TEXT NOT NULL DEFAULT 'primary'
                            CHECK (avatar_color IN ('primary','info','success','warning','danger')),
        is_self             INTEGER NOT NULL DEFAULT 0 CHECK (is_self IN (0,1)),
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_family_members_user
        ON family_members (user_id, is_self);
      -- At most one "Me" per account, enforced by the database.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_self
        ON family_members (user_id) WHERE is_self = 1;

      -- Every medicine and condition belongs to one member. NULL only exists
      -- transiently for rows written before this version; FamilyRepository
      -- assigns them to "Me" the first time the account loads.
      ALTER TABLE medications ADD COLUMN member_id TEXT
        REFERENCES family_members (id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_medications_member
        ON medications (user_id, member_id);

      ALTER TABLE health_conditions ADD COLUMN member_id TEXT
        REFERENCES family_members (id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_health_conditions_member
        ON health_conditions (user_id, member_id);
    `,
  },
  // Milestone 5 adds version 4: the `reminders` and `doses` tables, with
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
