/**
 * "Use demo account" behaviour.
 *
 * The demo account must be created through the ordinary sign-up path on first
 * use, reused on later uses, and never silently overwrite or loop if something
 * unexpected already occupies its email.
 */

import { DEMO_ACCOUNT } from '@/config/demo';
import { signInAsDemo } from '@/services/auth/demoAccount';
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

describe('signInAsDemo', () => {
  let auth: LocalAuthService;

  beforeEach(() => {
    mockStore().clear();
    auth = new LocalAuthService();
  });

  it('creates the demo account on first use and signs in', async () => {
    const result = await signInAsDemo(auth);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.email).toBe(DEMO_ACCOUNT.email);
    expect(result.value.user.displayName).toBe(DEMO_ACCOUNT.displayName);
  });

  it('reuses the same account on later uses instead of creating a duplicate', async () => {
    const first = await signInAsDemo(auth);
    await auth.signOut();
    const second = await signInAsDemo(auth);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.user.id).toBe(first.value.user.id);
  });

  it('uses the ordinary sign-in path when the account already exists', async () => {
    await auth.signUp({
      displayName: DEMO_ACCOUNT.displayName,
      email: DEMO_ACCOUNT.email,
      password: DEMO_ACCOUNT.password,
    });
    await auth.signOut();

    const result = await signInAsDemo(auth);
    expect(result.ok).toBe(true);
  });

  it('reports a clear error if the demo email is taken by a different password', async () => {
    // Not reachable through the UI, but it must not loop or clobber anything.
    await auth.signUp({
      displayName: 'Someone Else',
      email: DEMO_ACCOUNT.email,
      password: 'a-different-password',
    });
    await auth.signOut();

    const result = await signInAsDemo(auth);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('EMAIL_IN_USE');
  });
});
