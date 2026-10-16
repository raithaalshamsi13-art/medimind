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
  | 'NOT_ALLOWED'
  // Infrastructure
  | 'STORAGE_UNAVAILABLE'
  | 'NETWORK_UNAVAILABLE'
  | 'ASSISTANT_UNAVAILABLE'
  | 'SCANNER_NOT_CONFIGURED'
  // Scanning — each one says what actually happened
  | 'SERVER_UNREACHABLE'
  | 'SCAN_APP_KEY_REJECTED'
  | 'SCAN_PROVIDER_KEY_INVALID'
  | 'SCAN_NO_VISION'
  | 'SCAN_RATE_LIMITED'
  | 'SCAN_PROVIDER_BUSY'
  | 'SCAN_IMAGE_TOO_LARGE'
  | 'SCAN_TIMEOUT'
  | 'SCAN_SERVER_ERROR'
  | 'SCAN_DEVICE_ERROR'
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
  NOT_ALLOWED: 'That action is not allowed.',
  STORAGE_UNAVAILABLE:
    'MediMind could not save data on this device. Please restart the app and try again.',
  NETWORK_UNAVAILABLE:
    'You appear to be offline. Your saved medicines and reminders still work without internet.',
  ASSISTANT_UNAVAILABLE:
    'The assistant could not be reached right now. Your saved medicines are not affected. Please try again later, or ask a pharmacist.',
  SCANNER_NOT_CONFIGURED:
    'Real label reading is not set up on this build: the MediMind server address is missing. Turn on Demo Mode to see example readings, or enter the medicine by hand.',
  SERVER_UNREACHABLE:
    'You are online, but the MediMind server did not answer at its address. It may be stopped or not deployed. The server owner can check it under Settings → Scanner → Test connection.',
  SCAN_APP_KEY_REJECTED:
    'The server refused this app’s access key. The key in the app build and the APP_ACCESS_KEY on the server must match.',
  SCAN_PROVIDER_KEY_INVALID:
    'The server reached the AI provider, but its AI key was rejected. The server owner needs to check the Gemini key on Railway.',
  SCAN_NO_VISION:
    'The server’s AI provider cannot read images. Label reading needs a Gemini or Claude key on the server.',
  SCAN_RATE_LIMITED: 'Too many scans in a short time. Please wait a minute and try again.',
  SCAN_PROVIDER_BUSY:
    'The AI provider that reads labels is busy right now (high demand). Nothing is wrong with your photo — please try again in a minute.',
  SCAN_IMAGE_TOO_LARGE: 'The photo was too large to send. Please take it again a little further from the label.',
  SCAN_TIMEOUT: 'Reading the label took too long and was stopped. Check your connection and try again.',
  SCAN_SERVER_ERROR: 'The MediMind server could not read this photo right now. Please try again in a moment.',
  SCAN_DEVICE_ERROR: 'The phone could not read text from this photo. Please take it again.',
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
