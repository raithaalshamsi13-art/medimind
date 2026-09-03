/**
 * A minimal structural description of the database handle we need.
 *
 * WHY NOT JUST USE `SQLiteDatabase` FROM expo-sqlite?
 * Because expo-sqlite is a native module and cannot run inside Jest. By
 * depending on this small interface instead, the repository can be pointed at
 * expo-sqlite on the device and at Node's built-in `node:sqlite` in tests —
 * which means the SQL in this project is executed by a real SQLite engine in
 * CI, not replaced by a hand-written mock that could drift from reality.
 *
 * `SQLiteDatabase` satisfies this shape structurally, so no adapter is needed
 * on the device.
 */

/** Values SQLite can bind to a `?` placeholder in this app. */
export type SqlBindValue = string | number | null;

export type SqlRunResult = {
  lastInsertRowId: number;
  changes: number;
};

export type SqlDatabase = {
  /** Run one or more statements with no parameters (DDL, PRAGMA). */
  execAsync(source: string): Promise<void>;
  /** Run a write statement and report how many rows changed. */
  runAsync(source: string, params: SqlBindValue[]): Promise<SqlRunResult>;
  /** Read every matching row. */
  getAllAsync<T>(source: string, params: SqlBindValue[]): Promise<T[]>;
  /** Read the first matching row, or null. */
  getFirstAsync<T>(source: string, params: SqlBindValue[]): Promise<T | null>;
  /** Run `task` inside a transaction, rolling back if it throws. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};
