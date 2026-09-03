/**
 * Tests for the offline account provider.
 *
 * Covers the "Authentication" test list from the project plan: sign up, login,
 * logout and invalid login — plus two security properties that are easy to
 * regress: passwords are never stored in plaintext, and a failed login does
 * not reveal whether the email is registered.
 *
 * expo-secure-store and expo-crypto are native modules, so both are replaced
 * here: storage with an in-memory Map, and crypto with Node's real crypto so
 * the hashing behaviour under test is genuine rather than stubbed.
 */

import { STORAGE_KEYS } from '@/lib/storage';
import { LocalAuthService } from '@/services/auth/LocalAuthService';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    isAvailableAsync: async () => true,
    getItemAsync: async (key: string) => (store.has(key) ? store.get(key) : null),
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
});

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomBytesAsync: async (byteCount: number) =>
      new Uint8Array(nodeCrypto.randomBytes(byteCount)),
    digestStringAsync: async (_algorithm: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data).digest('hex'),
  };
});

function mockStore(): Map<string, string> {
  return (jest.requireMock('expo-secure-store') as { __store: Map<string, string> }).__store;
}

const VALID_SIGNUP = {
  displayName: 'Omar',
  email: 'omar@example.com',
  password: 'medimind123',
};

describe('LocalAuthService', () => {
  let auth: LocalAuthService;

  beforeEach(() => {
    mockStore().clear();
    auth = new LocalAuthService();
  });

  describe('signUp', () => {
    it('creates an account and returns a session', async () => {
      const result = await auth.signUp(VALID_SIGNUP);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.user.email).toBe('omar@example.com');
      expect(result.value.user.displayName).toBe('Omar');
      expect(result.value.provider).toBe('local');
      // Local accounts have no bearer token — that is a cloud-provider concept.
      expect(result.value.accessToken).toBeNull();
    });

    it('rejects an email that is already registered', async () => {
      await auth.signUp(VALID_SIGNUP);
      const result = await auth.signUp(VALID_SIGNUP);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('EMAIL_IN_USE');
    });

    it('treats emails as case-insensitive when detecting duplicates', async () => {
      await auth.signUp(VALID_SIGNUP);
      const result = await auth.signUp({ ...VALID_SIGNUP, email: 'OMAR@Example.com' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('EMAIL_IN_USE');
    });

    it('rejects a weak password with a friendly message', async () => {
      const result = await auth.signUp({ ...VALID_SIGNUP, password: 'abc' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('WEAK_PASSWORD');
      expect(result.error.message).toContain('8 characters');
    });

    it('rejects an invalid email', async () => {
      const result = await auth.signUp({ ...VALID_SIGNUP, email: 'nope' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_EMAIL');
    });

    it('never stores the password in plaintext', async () => {
      await auth.signUp(VALID_SIGNUP);

      const stored = mockStore().get(STORAGE_KEYS.localAccounts);
      expect(stored).toBeDefined();
      expect(stored).not.toContain(VALID_SIGNUP.password);
      // A salt and a digest should both be present.
      expect(stored).toContain('salt');
      expect(stored).toContain('passwordHash');
    });

    it('gives two accounts different salts, so identical passwords hash differently', async () => {
      await auth.signUp(VALID_SIGNUP);
      await auth.signUp({ ...VALID_SIGNUP, email: 'second@example.com' });

      const accounts = JSON.parse(mockStore().get(STORAGE_KEYS.localAccounts) ?? '{}');
      const first = accounts['omar@example.com'];
      const second = accounts['second@example.com'];

      expect(first.salt).not.toBe(second.salt);
      expect(first.passwordHash).not.toBe(second.passwordHash);
    });
  });

  describe('signIn', () => {
    beforeEach(async () => {
      await auth.signUp(VALID_SIGNUP);
      await auth.signOut();
    });

    it('succeeds with the correct password', async () => {
      const result = await auth.signIn({
        email: VALID_SIGNUP.email,
        password: VALID_SIGNUP.password,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.user.email).toBe('omar@example.com');
    });

    it('accepts an email typed with different capitalisation', async () => {
      const result = await auth.signIn({
        email: '  OMAR@example.COM  ',
        password: VALID_SIGNUP.password,
      });

      expect(result.ok).toBe(true);
    });

    it('rejects the wrong password', async () => {
      const result = await auth.signIn({ email: VALID_SIGNUP.email, password: 'wrongpassword' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('does not reveal whether an email is registered', async () => {
      const unknownEmail = await auth.signIn({
        email: 'nobody@example.com',
        password: 'medimind123',
      });
      const wrongPassword = await auth.signIn({
        email: VALID_SIGNUP.email,
        password: 'wrongpassword',
      });

      expect(unknownEmail.ok).toBe(false);
      expect(wrongPassword.ok).toBe(false);
      if (unknownEmail.ok || wrongPassword.ok) return;

      // Identical code AND identical message — otherwise the login screen
      // becomes a tool for discovering which emails have accounts.
      expect(unknownEmail.error.code).toBe(wrongPassword.error.code);
      expect(unknownEmail.error.message).toBe(wrongPassword.error.message);
    });
  });

  describe('session lifecycle', () => {
    it('returns null when nobody has ever signed in', async () => {
      const result = await auth.restoreSession();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
    });

    it('restores the session after signing up', async () => {
      await auth.signUp(VALID_SIGNUP);

      const result = await auth.restoreSession();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value?.user.email).toBe('omar@example.com');
    });

    it('clears the session on sign out but keeps the account', async () => {
      await auth.signUp(VALID_SIGNUP);
      await auth.signOut();

      const restored = await auth.restoreSession();
      expect(restored.ok).toBe(true);
      if (!restored.ok) return;
      expect(restored.value).toBeNull();

      // The account itself must survive, so the user can log back in.
      const signedIn = await auth.signIn({
        email: VALID_SIGNUP.email,
        password: VALID_SIGNUP.password,
      });
      expect(signedIn.ok).toBe(true);
    });

    it('ignores a stored session belonging to a different provider', async () => {
      await auth.signUp(VALID_SIGNUP);

      // Simulate a session left behind by the Supabase provider.
      const raw = mockStore().get(STORAGE_KEYS.session);
      const session = JSON.parse(raw ?? '{}');
      mockStore().set(
        STORAGE_KEYS.session,
        JSON.stringify({ ...session, provider: 'supabase', accessToken: 'stale-token' }),
      );

      const result = await auth.restoreSession();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
    });

    it('ignores a session whose account no longer exists on the device', async () => {
      await auth.signUp(VALID_SIGNUP);
      mockStore().delete(STORAGE_KEYS.localAccounts);

      const result = await auth.restoreSession();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
    });

    it('discards a corrupt session instead of crashing', async () => {
      mockStore().set(STORAGE_KEYS.session, '{ this is not json');

      const result = await auth.restoreSession();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
    });
  });
});
