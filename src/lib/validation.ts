/**
 * Bridge between Zod validation results and per-field form errors.
 *
 * Keeps screens free of validation logic: a screen parses its input with the
 * schema from `@/domain`, and on failure gets back a plain
 * `{ fieldName: message }` object it can hand straight to <TextField error>.
 */

import type { ZodError } from 'zod';

export function fieldErrorsOf<TField extends string>(
  error: ZodError,
): Partial<Record<TField, string>> {
  const errors: Partial<Record<TField, string>> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    // Keep the FIRST message per field — it is the most specific one.
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as TField] = issue.message;
    }
  }

  return errors;
}
