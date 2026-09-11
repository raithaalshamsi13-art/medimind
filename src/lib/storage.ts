/**
 * Small-value key–value storage.
 *
 * Used for the session, local account records and user preferences — i.e.
 * small, sensitive values. Medication data goes in SQLite (Milestone 3), not
 * here.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE THREE BACKENDS
 *
 * `expo-secure-store` is a NATIVE module. It is the right store on a phone
 * (values are encrypted by the Android Keystore / iOS Keychain), but it simply
 * does not exist on web, and a hostile environment can make it throw. If the
 * app treated that as fatal, a missing storage backend would make MediMind
 * completely unusable — you could not even sign in.
 *
 * So storage is a small interface with a chain of fallbacks:
 *
 *   1. secure-store   native, encrypted by the OS          ← phones
 *   2. local-storage  browser localStorage, NOT encrypted  ← web preview only
 *   3. memory         in-process Map, lost on reload       ← last resort
 *
 * The app keeps working in every case; what changes is durability, and
 * `getStorageKind()` lets the UI tell the user the truth about it.
 * ---------------------------------------------------------------------------
 *
 * Platform constraints for secure-store, per the SDK 57 docs:
 *   - keys may contain only alphanumerics and `.`, `-`, `_`
 *   - values above ~2048 bytes can be rejected by iOS, so we warn in dev
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { appError, toAppError } from './errors';
import { fail, ok, type Result } from './result';

export const STORAGE_KEYS = {
  /** The signed-in session. */
  session: 'medimind.session',
  /** Offline account records (local auth provider only). */
  localAccounts: 'medimind.local.accounts',
  /** User preferences: onboarding done, accessibility, voice, notifications. */
  preferences: 'medimind.preferences',
  /**
   * Medicines, for the JSON fallback repository only (web). On a device this
   * data lives in SQLite, not here.
   */
  medications: 'medimind.medications',
  /** Health conditions, JSON fallback repository only (web). */
  healthConditions: 'medimind.health-conditions',
} as const;

const VALID_KEY = /^[A-Za-z0-9._-]+$/;
const SIZE_WARNING_BYTES = 2048;

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

export type StorageKind = 'secure-store' | 'local-storage' | 'memory';

type StorageBackend = {
  readonly kind: StorageKind;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const secureStoreBackend: StorageBackend = {
  kind: 'secure-store',
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/** Browser storage. Only reachable on web, and deliberately not trusted. */
function createLocalStorageBackend(): StorageBackend | null {
  try {
    if (typeof localStorage === 'undefined') return null;

    // Probe it: Safari private mode has the API but throws on write.
    const probe = 'medimind.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);

    return {
      kind: 'local-storage',
      getItem: async (key) => localStorage.getItem(key),
      setItem: async (key, value) => {
        localStorage.setItem(key, value);
      },
      removeItem: async (key) => {
        localStorage.removeItem(key);
      },
    };
  } catch {
    return null;
  }
}

function createMemoryBackend(): StorageBackend {
  const values = new Map<string, string>();
  return {
    kind: 'memory',
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}

function selectBackend(): StorageBackend {
  if (Platform.OS !== 'web') return secureStoreBackend;
  return createLocalStorageBackend() ?? createMemoryBackend();
}

let backend: StorageBackend = selectBackend();
let hasDegraded = false;

/**
 * Which backend is actually in use. The UI uses this to warn the user when
 * their data will not survive a restart.
 */
export function getStorageKind(): StorageKind {
  return backend.kind;
}

/** True when data written now will still be there after an app restart. */
export function isStoragePersistent(): boolean {
  return backend.kind !== 'memory';
}

/**
 * Run a storage operation, dropping to the in-memory backend if the current
 * one throws. Degrading once and staying degraded avoids hammering a broken
 * native module on every keystroke.
 */
async function withFallback<T>(operation: (b: StorageBackend) => Promise<T>): Promise<T> {
  try {
    return await operation(backend);
  } catch (error) {
    if (backend.kind === 'memory') throw error;

    const previous = backend.kind;
    backend = createMemoryBackend();
    hasDegraded = true;

    console.warn(
      `[MediMind] Storage backend "${previous}" failed and was replaced with ` +
        `in-memory storage. Data will not survive a restart. Cause: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );

    return operation(backend);
  }
}

/** True if the preferred backend failed and we fell back at runtime. */
export function hasStorageDegraded(): boolean {
  return hasDegraded;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function assertValidKey(key: string): void {
  if (!VALID_KEY.test(key)) {
    throw new Error(`Invalid storage key "${key}" — use only A-Z a-z 0-9 . - _`);
  }
}

/** Read and parse a JSON value. Returns null when absent or corrupt. */
export async function readJson<T>(key: string): Promise<Result<T | null>> {
  try {
    assertValidKey(key);
    const raw = await withFallback((b) => b.getItem(key));
    if (raw === null) return ok(null);

    try {
      return ok(JSON.parse(raw) as T);
    } catch {
      // Corrupt entry — drop it rather than crash the app on every launch.
      if (__DEV__) console.warn(`[MediMind] Discarding corrupt storage entry "${key}"`);
      await withFallback((b) => b.removeItem(key));
      return ok(null);
    }
  } catch (error) {
    return fail(toAppError(error, 'STORAGE_UNAVAILABLE'));
  }
}

/** Serialise and store a JSON value. */
export async function writeJson(key: string, value: unknown): Promise<Result<void>> {
  try {
    assertValidKey(key);
    const raw = JSON.stringify(value);

    // The ~2048-byte ceiling is a secure-store/iOS Keychain constraint, so the
    // warning is only meaningful on that backend. localStorage allows megabytes.
    if (__DEV__ && backend.kind === 'secure-store' && raw.length > SIZE_WARNING_BYTES) {
      console.warn(
        `[MediMind] Storage entry "${key}" is ${raw.length} bytes. ` +
          `Values over ${SIZE_WARNING_BYTES} bytes may be rejected — move this data to SQLite.`,
      );
    }

    await withFallback((b) => b.setItem(key, raw));
    return ok(undefined);
  } catch (error) {
    return fail(toAppError(error, 'STORAGE_UNAVAILABLE'));
  }
}

/** Delete a stored value. Succeeds even if the key was never set. */
export async function removeItem(key: string): Promise<Result<void>> {
  try {
    assertValidKey(key);
    await withFallback((b) => b.removeItem(key));
    return ok(undefined);
  } catch (error) {
    return fail(toAppError(error, 'STORAGE_UNAVAILABLE'));
  }
}

/** Confirm storage works on this device before relying on it. */
export async function isStorageAvailable(): Promise<Result<boolean>> {
  try {
    if (backend.kind === 'secure-store') {
      return ok(await SecureStore.isAvailableAsync());
    }
    return ok(true);
  } catch (error) {
    return fail(appError('STORAGE_UNAVAILABLE', String(error)));
  }
}
