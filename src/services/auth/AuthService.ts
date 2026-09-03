/**
 * Authentication contract.
 *
 * Screens depend on this interface, never on a concrete provider. That is what
 * lets MediMind run with offline accounts today and switch to Supabase Auth by
 * changing one line in the factory — with no screen changes at all.
 */

import type { AuthProvider, AuthSession, SignInInput, SignUpInput } from '@/domain/user';
import type { Result } from '@/lib/result';

export interface AuthService {
  /** Which backend this implementation talks to. Shown in Settings. */
  readonly provider: AuthProvider;

  /** True when accounts live only on this device (no cloud backup). */
  readonly isLocalOnly: boolean;

  /**
   * Restore a previously saved session on app launch.
   * Resolves to `null` when nobody is signed in — that is not an error.
   */
  restoreSession(): Promise<Result<AuthSession | null>>;

  signUp(input: SignUpInput): Promise<Result<AuthSession>>;

  signIn(input: SignInInput): Promise<Result<AuthSession>>;

  signOut(): Promise<Result<void>>;
}
