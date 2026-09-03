/**
 * Auth service factory.
 *
 * This is the ONLY place that decides which provider is in use. Swapping to
 * Supabase Auth is a change to this file and nothing else.
 */

import { isSupabaseConfigured } from '@/config/env';

import type { AuthService } from './AuthService';
import { LocalAuthService } from './LocalAuthService';

function createAuthService(): AuthService {
  if (isSupabaseConfigured) {
    // Milestone 2b: return new SupabaseAuthService() once the project's URL
    // and anon key are in .env.local. Until then we deliberately stay on
    // local accounts rather than half-using a cloud backend.
    if (__DEV__) {
      console.log(
        '[MediMind] Supabase credentials detected. Cloud auth is added in Milestone 2b; ' +
          'using offline accounts for now.',
      );
    }
  }
  return new LocalAuthService();
}

/** Single shared instance used by the auth store. */
export const authService: AuthService = createAuthService();

export type { AuthService } from './AuthService';
export { LocalAuthService } from './LocalAuthService';
