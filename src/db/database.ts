/**
 * SQLite connection management.
 *
 * The database is opened once, lazily, and the same handle is reused for the
 * life of the app. Migrations run as part of opening it, so no caller ever sees
 * a half-migrated schema.
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { runMigrations } from './migrations';
import type { SqlDatabase } from './types';

export const DATABASE_NAME = 'medimind.db';

let handle: Promise<SqlDatabase> | null = null;

/**
 * Whether SQLite can be used on this platform.
 *
 * `expo-sqlite` web support is labelled **alpha** in SDK 57 and additionally
 * requires WASM bundler configuration plus `Cross-Origin-Embedder-Policy` /
 * `Cross-Origin-Opener-Policy` headers to get `SharedArrayBuffer`. Rather than
 * ship an unstable database in the browser, the app falls back to the JSON
 * repository there — see `db/repositories/index.ts`.
 */
export function isSqliteSupported(): boolean {
  return Platform.OS !== 'web';
}

async function openAndMigrate(): Promise<SqlDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // WAL gives better read/write concurrency. Foreign keys are OFF by default
  // in SQLite and must be enabled per connection — Milestone 5's reminders and
  // doses rely on ON DELETE CASCADE, so this has to be set now and stay set.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const version = await runMigrations(db);
  if (__DEV__) {
    console.log(`[MediMind] SQLite ready — ${DATABASE_NAME}, schema v${version}`);
  }
  return db;
}

/** Open (or reuse) the database. Rejects if SQLite is unavailable. */
export function getDatabase(): Promise<SqlDatabase> {
  if (!handle) {
    handle = openAndMigrate().catch((error) => {
      // Clear the cached promise so a later attempt can retry rather than
      // being stuck with a permanently rejected handle.
      handle = null;
      throw error;
    });
  }
  return handle;
}

/** Drop the cached handle. Used by tests and by a full sign-out reset. */
export function resetDatabaseHandle(): void {
  handle = null;
}
