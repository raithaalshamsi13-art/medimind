/**
 * Offline account provider.
 *
 * WHY THIS EXISTS
 * Accounts are stored on the device, encrypted by the OS (Android Keystore /
 * iOS Keychain) via expo-secure-store. This means MediMind is fully usable —
 * sign up, log in, log out — with no backend, no internet and no API keys, so
 * the graduation demo can never be broken by a service outage.
 *
 * SECURITY LIMITATION — STATED HONESTLY
 * Passwords are stored as a salted SHA-256 digest. SHA-256 is a fast hash, not
 * a password-stretching function like bcrypt or Argon2, so this would not be
 * acceptable for a real server. It is used here because:
 *   1. no Argon2/bcrypt implementation is available in Expo Go without a
 *      custom native module, and
 *   2. the real protection for on-device data is the OS keystore encryption
 *      that already wraps this value.
 * When Supabase Auth is configured, SupabaseAuthService takes over and
 * passwords are hashed server-side with bcrypt. Local accounts are a
 * development and offline-demo path, and Settings labels them as such.
 */

import * as Crypto from 'expo-crypto';

import type { AuthProvider, AuthSession, SignInInput, SignUpInput } from '@/domain/user';
import { signInSchema, signUpSchema } from '@/domain/user';
import { isoNow } from '@/lib/datetime';
import { appError, customError, toAppError, type AppErrorCode } from '@/lib/errors';
import { fail, ok, type Result } from '@/lib/result';
import { readJson, removeItem, STORAGE_KEYS, writeJson } from '@/lib/storage';

import type { AuthService } from './AuthService';

type LocalAccount = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  salt: string;
  passwordHash: string;
};

/** Keyed by lowercase email. */
type LocalAccountStore = Record<string, LocalAccount>;

/** Map a Zod field path to the most specific error code we have. */
function codeForField(field: string | number | symbol | undefined): AppErrorCode {
  if (field === 'email') return 'INVALID_EMAIL';
  if (field === 'password') return 'WEAK_PASSWORD';
  return 'MISSING_FIELD';
}

export class LocalAuthService implements AuthService {
  readonly provider: AuthProvider = 'local';
  readonly isLocalOnly = true;

  async restoreSession(): Promise<Result<AuthSession | null>> {
    const stored = await readJson<AuthSession>(STORAGE_KEYS.session);
    if (!stored.ok) return stored;
    if (stored.value === null) return ok(null);

    // A session for a different provider (e.g. left over after Supabase was
    // configured then removed) must not be trusted by this service.
    if (stored.value.provider !== this.provider) {
      await removeItem(STORAGE_KEYS.session);
      return ok(null);
    }

    // Confirm the account still exists on this device.
    const accounts = await this.loadAccounts();
    if (!accounts.ok) return accounts;
    if (!accounts.value[stored.value.user.email]) {
      await removeItem(STORAGE_KEYS.session);
      return ok(null);
    }

    return ok(stored.value);
  }

  async signUp(input: SignUpInput): Promise<Result<AuthSession>> {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(customError(codeForField(issue.path[0]), issue.message));
    }
    const { email, password, displayName } = parsed.data;

    const accounts = await this.loadAccounts();
    if (!accounts.ok) return accounts;

    if (accounts.value[email]) {
      return fail(appError('EMAIL_IN_USE'));
    }

    try {
      const salt = await this.createSalt();
      const account: LocalAccount = {
        id: Crypto.randomUUID(),
        email,
        displayName,
        createdAt: isoNow(),
        salt,
        passwordHash: await this.hashPassword(password, salt),
      };

      const saved = await writeJson(STORAGE_KEYS.localAccounts, {
        ...accounts.value,
        [email]: account,
      });
      if (!saved.ok) return saved;

      return this.startSession(account);
    } catch (error) {
      return fail(toAppError(error));
    }
  }

  async signIn(input: SignInInput): Promise<Result<AuthSession>> {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(customError(codeForField(issue.path[0]), issue.message));
    }
    const { email, password } = parsed.data;

    const accounts = await this.loadAccounts();
    if (!accounts.ok) return accounts;

    const account = accounts.value[email];
    // Same error for "no such account" and "wrong password", so the screen
    // cannot be used to discover which emails are registered.
    if (!account) {
      return fail(appError('INVALID_CREDENTIALS'));
    }

    try {
      const candidate = await this.hashPassword(password, account.salt);
      if (candidate !== account.passwordHash) {
        return fail(appError('INVALID_CREDENTIALS'));
      }
      return this.startSession(account);
    } catch (error) {
      return fail(toAppError(error));
    }
  }

  async signOut(): Promise<Result<void>> {
    // Only the session is cleared. The account record stays so the user can
    // log back in — and, from Milestone 3, so does their medication data.
    return removeItem(STORAGE_KEYS.session);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async loadAccounts(): Promise<Result<LocalAccountStore>> {
    const stored = await readJson<LocalAccountStore>(STORAGE_KEYS.localAccounts);
    if (!stored.ok) return stored;
    return ok(stored.value ?? {});
  }

  /** 16 random bytes as hex — unique per account. */
  private async createSalt(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private hashPassword(password: string, salt: string): Promise<string> {
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `medimind.v1:${salt}:${password}`,
    );
  }

  private async startSession(account: LocalAccount): Promise<Result<AuthSession>> {
    const session: AuthSession = {
      user: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        createdAt: account.createdAt,
      },
      provider: this.provider,
      issuedAt: isoNow(),
      accessToken: null,
    };

    const saved = await writeJson(STORAGE_KEYS.session, session);
    if (!saved.ok) return fail(saved.error);

    return ok(session);
  }
}
