/**
 * Web build of the database module.
 *
 * Metro resolves `database.web.ts` instead of `database.ts` when bundling for
 * web, which is the whole point of this file: it contains NO import of
 * `expo-sqlite`.
 *
 * WHY THAT MATTERS
 * `expo-sqlite`'s web build ships a Web Worker (`expo-sqlite/web/worker.ts`)
 * plus a WASM payload. Merely importing the module — even without ever calling
 * `openDatabaseAsync` — forces Metro to bundle that worker, and the dev server
 * then fails with:
 *
 *     Server Error
 *     Worker chunk not found for: .../expo-sqlite/web/worker.ts
 *
 * Registering `wasm` as an asset extension is enough to make a production
 * export succeed, but not enough for the dev server. Splitting the module by
 * platform removes the dependency altogether, which fixes both.
 *
 * The browser uses `JsonMedicationRepository` instead; the factory in
 * `repositories/index.ts` checks `isSqliteSupported()` before ever calling
 * `getDatabase()`, so the rejection below is unreachable in normal use.
 */

import type { SqlDatabase } from './types';

export const DATABASE_NAME = 'medimind.db';

/**
 * Always false on web.
 *
 * `expo-sqlite` does have a web implementation, but in SDK 57 it is labelled
 * alpha and additionally needs `Cross-Origin-Embedder-Policy` /
 * `Cross-Origin-Opener-Policy` headers to obtain `SharedArrayBuffer`. Shipping
 * an unstable database to the browser is not worth it when the browser is only
 * a convenience for UI work.
 */
export function isSqliteSupported(): boolean {
  return false;
}

export function getDatabase(): Promise<SqlDatabase> {
  return Promise.reject(
    new Error(
      'SQLite is not used in the browser. MediMind falls back to the JSON repository here; ' +
        'open the app on a phone for the real database.',
    ),
  );
}

export function resetDatabaseHandle(): void {
  // Nothing to reset — no connection is ever opened on web.
}
