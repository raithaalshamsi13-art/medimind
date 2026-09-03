/**
 * Result type — explicit success/failure instead of thrown exceptions.
 *
 * Services return `Result<T>` so that a screen is forced by the type system to
 * handle the failure case. This is how we guarantee the app "never simply
 * crashes or displays technical error messages" (Phase 17).
 *
 *   const result = await auth.signIn({ email, password });
 *   if (!result.ok) { setError(result.error.message); return; }
 *   // result.value is typed and safe here
 */

import type { AppError } from './errors';

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: AppError): Result<T> {
  return { ok: false, error };
}
