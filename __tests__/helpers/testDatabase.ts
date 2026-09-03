/**
 * Adapter that makes Node's built-in SQLite look like `SqlDatabase`.
 *
 * This is why `src/db/types.ts` defines a small structural interface instead of
 * importing expo-sqlite's type directly: expo-sqlite is a native module and
 * cannot load under Jest, but the SQL itself absolutely should be tested.
 *
 * With this adapter, the migrations and every query in
 * `SqliteMedicationRepository` are executed by a real SQLite engine — including
 * the CHECK constraints and `COLLATE NOCASE` ordering — rather than against a
 * hand-written mock that could quietly drift away from how SQLite behaves.
 */

import { DatabaseSync } from 'node:sqlite';

import type { SqlBindValue, SqlDatabase } from '@/db/types';

export type TestDatabase = SqlDatabase & { close(): void };

export function createTestDatabase(): TestDatabase {
  const db = new DatabaseSync(':memory:');

  // Match the pragmas the real app sets when it opens the database.
  db.exec('PRAGMA foreign_keys = ON;');

  return {
    async execAsync(source: string): Promise<void> {
      db.exec(source);
    },

    async runAsync(source: string, params: SqlBindValue[]) {
      const result = db.prepare(source).run(...params);
      return {
        // node:sqlite reports these as bigint.
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },

    async getAllAsync<T>(source: string, params: SqlBindValue[]): Promise<T[]> {
      return db.prepare(source).all(...params) as T[];
    },

    async getFirstAsync<T>(source: string, params: SqlBindValue[]): Promise<T | null> {
      const row = db.prepare(source).get(...params);
      return (row ?? null) as T | null;
    },

    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    close() {
      db.close();
    },
  };
}
