/**
 * Error catalogue.
 *
 * PHASE 17 RULE: the user never sees a technical error message or a stack
 * trace. Every failure in MediMind is converted into an `AppError` that
 * carries a friendly, actionable sentence. Technical details go in `detail`,
 * which is logged but never rendered.
 */

export type AppErrorCode =
  // Auth / validation
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'MISSING_FIELD'
  | 'EMAIL_IN_USE'
  | 'INVALID_CREDENTIALS'
  // Data
  | 'DATABASE_ERROR'
  | 'NOT_FOUND'
  // Infrastructure
  | 'STORAGE_UNAVAILABLE'
  | 'NETWORK_UNAVAILABLE'
  | 'ASSISTANT_UNAVAILABLE'
  | 'UNKNOWN';

export type AppError = {
  code: AppErrorCode;
  /** Safe to display. Plain language, says what to do next. */
  message: string;
  /** For logs only. Never rendered in the UI. */
  detail?: string;
};

const FRIENDLY_MESSAGES: Record<AppErrorCode, string> = {
  INVALID_EMAIL: 'Please enter a valid email address, for example name@example.com.',
  WEAK_PASSWORD: 'Your password needs to be at least 8 characters long.',
  MISSING_FIELD: 'Please fill in all the fields to continue.',
  EMAIL_IN_USE: 'An account already exists with this email. Try logging in instead.',
  INVALID_CREDENTIALS: 'That email or password is not correct. Please try again.',
  DATABASE_ERROR:
    'MediMind could not open your saved medicines. Please close the app completely and open it again.',
  NOT_FOUND: 'That medicine could not be found. It may have already been deleted.',
  STORAGE_UNAVAILABLE:
    'MediMind could not save data on this device. Please restart the app and try again.',
  NETWORK_UNAVAILABLE:
    'You appear to be offline. Your saved medicines and reminders still work without internet.',
  ASSISTANT_UNAVAILABLE:
    'The assistant could not be reached right now. Your saved medicines are not affected. Please try again later, or ask a pharmacist.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

/** Build an AppError with its standard friendly message. */
export function appError(code: AppErrorCode, detail?: string): AppError {
  return { code, message: FRIENDLY_MESSAGES[code], detail };
}

/** Build an AppError with a custom message (still user-safe). */
export function customError(code: AppErrorCode, message: string, detail?: string): AppError {
  return { code, message, detail };
}

/**
 * Last-resort conversion of an unknown thrown value. Use in catch blocks so a
 * crash becomes a friendly message instead of a red screen.
 */
export function toAppError(error: unknown, code: AppErrorCode = 'UNKNOWN'): AppError {
  const detail = error instanceof Error ? error.message : String(error);
  if (__DEV__) {
    console.warn(`[MediMind] ${code}:`, detail);
  }
  return appError(code, detail);
}
