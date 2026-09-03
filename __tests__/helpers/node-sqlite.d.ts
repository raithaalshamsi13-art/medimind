/**
 * Minimal type declarations for Node's built-in `node:sqlite` module.
 *
 * Declared locally rather than by installing `@types/node`, because pulling
 * Node's global types into a React Native project changes the meaning of
 * shared globals (`setTimeout` starts returning `NodeJS.Timeout` instead of a
 * number, for example). This module is only ever imported by test helpers.
 */

declare module 'node:sqlite' {
  export interface StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
