/**
 * Storage resilience.
 *
 * This suite deliberately makes expo-secure-store throw on every call, which
 * is what actually happens when the app runs somewhere the native module does
 * not exist (a web browser, for example).
 *
 * The requirement being locked in: a missing storage backend must NOT make
 * MediMind unusable. It should degrade to in-memory storage, keep working, and
 * report honestly that data is no longer durable.
 */

import {
  getStorageKind,
  hasStorageDegraded,
  isStoragePersistent,
  readJson,
  removeItem,
  STORAGE_KEYS,
  writeJson,
} from '@/lib/storage';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => false,
  getItemAsync: async () => {
    throw new Error('SecureStore is not available on this platform');
  },
  setItemAsync: async () => {
    throw new Error('SecureStore is not available on this platform');
  },
  deleteItemAsync: async () => {
    throw new Error('SecureStore is not available on this platform');
  },
}));

beforeAll(() => {
  // The fallback logs a deliberate warning; keep the test output readable.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('storage fallback', () => {
  it('starts out preferring the native secure store', () => {
    expect(getStorageKind()).toBe('secure-store');
    expect(hasStorageDegraded()).toBe(false);
  });

  it('degrades to in-memory storage instead of failing the write', async () => {
    const result = await writeJson(STORAGE_KEYS.preferences, { largeText: true });

    expect(result.ok).toBe(true);
    expect(getStorageKind()).toBe('memory');
    expect(hasStorageDegraded()).toBe(true);
  });

  it('reports that data is no longer persistent', () => {
    expect(isStoragePersistent()).toBe(false);
  });

  it('still round-trips values through the fallback', async () => {
    await writeJson(STORAGE_KEYS.session, { user: { email: 'omar@example.com' } });

    const result = await readJson<{ user: { email: string } }>(STORAGE_KEYS.session);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.user.email).toBe('omar@example.com');
  });

  it('returns null for a key that was never written', async () => {
    const result = await readJson('medimind.does-not-exist');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('deletes a value', async () => {
    await writeJson(STORAGE_KEYS.localAccounts, { a: 1 });
    await removeItem(STORAGE_KEYS.localAccounts);

    const result = await readJson(STORAGE_KEYS.localAccounts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('rejects a key containing illegal characters', async () => {
    // Secure storage only permits alphanumerics and . - _
    const result = await writeJson('medimind session!', { a: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('STORAGE_UNAVAILABLE');
  });
});
