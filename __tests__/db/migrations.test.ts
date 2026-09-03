/**
 * Schema migration tests.
 *
 * These run against a real in-memory SQLite engine (Node's built-in
 * `node:sqlite`), so they verify the actual DDL — including the CHECK
 * constraints, which are the database's own guarantee that no code path can
 * store an invalid safety status.
 */

import { LATEST_SCHEMA_VERSION, runMigrations } from '@/db/migrations';
import type { SqlBindValue } from '@/db/types';

import { createTestDatabase, type TestDatabase } from '../helpers/testDatabase';

const COLUMNS = [
  'id',
  'user_id',
  'name',
  'dosage',
  'instructions',
  'expiration_date',
  'frequency',
  'safety_status',
  'source',
  'scan_confidence',
  'notes',
  'image_uri',
  'archived',
  'created_at',
  'updated_at',
] as const;

type ColumnValues = Partial<Record<(typeof COLUMNS)[number], SqlBindValue>>;

function insertMedication(db: TestDatabase, overrides: ColumnValues = {}) {
  const values: Record<(typeof COLUMNS)[number], SqlBindValue> = {
    id: 'med-1',
    user_id: 'user-1',
    name: 'Paracetamol',
    dosage: null,
    instructions: null,
    expiration_date: null,
    frequency: null,
    safety_status: 'UNKNOWN',
    source: 'MANUAL',
    scan_confidence: null,
    notes: null,
    image_uri: null,
    archived: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };

  return db.runAsync(
    `INSERT INTO medications (${COLUMNS.join(', ')})
     VALUES (${COLUMNS.map(() => '?').join(', ')})`,
    COLUMNS.map((column) => values[column]),
  );
}

describe('migrations', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('starts a fresh database at user_version 0', async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(row?.user_version).toBe(0);
  });

  it('migrates up to the latest schema version', async () => {
    const version = await runMigrations(db);

    expect(version).toBe(LATEST_SCHEMA_VERSION);
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(row?.user_version).toBe(LATEST_SCHEMA_VERSION);
  });

  it('is idempotent — running twice changes nothing', async () => {
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
  });

  it('creates the medications table and its indexes', async () => {
    await runMigrations(db);

    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table'`,
      [],
    );
    expect(tables.map((t) => t.name)).toContain('medications');

    const indexes = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'medications'`,
      [],
    );
    expect(indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining([
        'idx_medications_user',
        'idx_medications_name',
        'idx_medications_expiry',
      ]),
    );
  });

  describe('database-level constraints', () => {
    beforeEach(async () => {
      await runMigrations(db);
    });

    it('accepts a valid row', async () => {
      await expect(insertMedication(db)).resolves.toBeDefined();
    });

    it('rejects a safety_status outside the allowed set', async () => {
      await expect(
        insertMedication(db, { id: 'bad', safety_status: 'PROBABLY_FINE' }),
      ).rejects.toThrow();
    });

    it('rejects a source outside the allowed set', async () => {
      await expect(insertMedication(db, { id: 'bad', source: 'GUESSED' })).rejects.toThrow();
    });

    it('rejects an archived flag that is not 0 or 1', async () => {
      await expect(insertMedication(db, { id: 'bad', archived: 2 })).rejects.toThrow();
    });

    it('rejects a missing name', async () => {
      await expect(insertMedication(db, { id: 'bad', name: null })).rejects.toThrow();
    });

    it('rejects a duplicate id', async () => {
      await insertMedication(db, { id: 'dupe' });
      await expect(insertMedication(db, { id: 'dupe' })).rejects.toThrow();
    });
  });
});
