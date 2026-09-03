/**
 * Authentication state.
 *
 * Screens never call the auth service directly — they go through this store,
 * which owns the session, the "submitting" flag and the current error message.
 * The sign-in / sign-up actions return a boolean so a screen can decide whether
 * to navigate, without having to duplicate the error handling.
 */

import { create } from 'zustand';

import type { AuthProvider, AuthSession, SignInInput, SignUpInput } from '@/domain/user';
import type { AppError } from '@/lib/errors';
import { authService } from '@/services/auth';
import { signInAsDemo as runDemoSignIn } from '@/services/auth/demoAccount';

type AuthStatus =
  /** Nothing has happened yet. */
  | 'idle'
  /** Reading the saved session from encrypted storage. */
  | 'restoring'
  /** Session restore finished — `session` is now authoritative. */
  | 'ready';

type AuthState = {
  session: AuthSession | null;
  status: AuthStatus;
  isSubmitting: boolean;
  error: AppError | null;

  /** Which provider is active — surfaced so screens don't import the service. */
  provider: AuthProvider;
  /** True when accounts exist only on this device (no cloud backup). */
  isLocalOnly: boolean;

  /** Run once on app launch, before the splash screen is hidden. */
  bootstrap: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<boolean>;
  signIn: (input: SignInInput) => Promise<boolean>;
  /** Demo mode only: sign in as the demo user, creating it on first use. */
  signInAsDemo: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: 'idle',
  isSubmitting: false,
  error: null,

  provider: authService.provider,
  isLocalOnly: authService.isLocalOnly,

  bootstrap: async () => {
    set({ status: 'restoring', error: null });
    const result = await authService.restoreSession();

    if (!result.ok) {
      // A storage failure must not block the app — the user can still sign in.
      set({ session: null, status: 'ready', error: result.error });
      return;
    }
    set({ session: result.value, status: 'ready' });
  },

  signUp: async (input) => {
    set({ isSubmitting: true, error: null });
    const result = await authService.signUp(input);

    if (!result.ok) {
      set({ isSubmitting: false, error: result.error });
      return false;
    }
    set({ session: result.value, isSubmitting: false, error: null });
    return true;
  },

  signIn: async (input) => {
    set({ isSubmitting: true, error: null });
    const result = await authService.signIn(input);

    if (!result.ok) {
      set({ isSubmitting: false, error: result.error });
      return false;
    }
    set({ session: result.value, isSubmitting: false, error: null });
    return true;
  },

  signInAsDemo: async () => {
    set({ isSubmitting: true, error: null });
    const result = await runDemoSignIn(authService);

    if (!result.ok) {
      set({ isSubmitting: false, error: result.error });
      return false;
    }
    set({ session: result.value, isSubmitting: false, error: null });
    return true;
  },

  signOut: async () => {
    set({ isSubmitting: true });
    await authService.signOut();
    // Clear the session regardless of the storage result: staying "signed in"
    // after the user asked to log out would be the worse failure.
    set({ session: null, isSubmitting: false, error: null });
  },

  clearError: () => set({ error: null }),
}));

/** Convenience selectors. */
export const selectUser = (state: AuthState) => state.session?.user ?? null;
export const selectIsSignedIn = (state: AuthState) => state.session !== null;
