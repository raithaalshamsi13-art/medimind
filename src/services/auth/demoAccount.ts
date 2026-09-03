/**
 * "Use demo account" — sign in, creating the account first if needed.
 *
 * Kept as a plain function over the AuthService interface (rather than inside
 * the store) so it can be unit-tested against LocalAuthService directly.
 */

import { DEMO_ACCOUNT } from '@/config/demo';
import type { AuthSession } from '@/domain/user';
import type { Result } from '@/lib/result';

import type { AuthService } from './AuthService';

export async function signInAsDemo(service: AuthService): Promise<Result<AuthSession>> {
  const signedIn = await service.signIn({
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
  });

  // Success, or a failure that is NOT "no such account / wrong password"
  // (e.g. storage broke) — either way, report it as-is.
  if (signedIn.ok || signedIn.error.code !== 'INVALID_CREDENTIALS') {
    return signedIn;
  }

  // First use on this device: create the account through the normal path.
  return service.signUp({
    displayName: DEMO_ACCOUNT.displayName,
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
  });
}
