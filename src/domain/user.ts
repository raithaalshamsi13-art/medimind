/**
 * User and session types, plus the Zod schemas that validate auth forms.
 *
 * Validation lives here (not in the screens) so the login form, the signup
 * form and the auth service all agree on what a valid email or password is.
 */

import { z } from 'zod';

/** Trim + lowercase before validating, so " Omar@X.com " is accepted. */
export const emailSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email('Please enter a valid email address, for example name@example.com.'),
);

export const passwordSchema = z
  .string()
  .min(8, 'Your password needs to be at least 8 characters long.');

export const displayNameSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .string()
    .min(1, 'Please enter your name.')
    .max(60, 'Please use a shorter name (60 characters or fewer).'),
);

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Sign-in only requires a non-empty password. We must not apply the 8-character
 * rule here — that would lock out an account created under an older rule and
 * would also leak information about password requirements.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Please enter your password.'),
});

/**
 * Raw form input, before validation. Declared explicitly rather than as
 * `z.input<typeof signUpSchema>` because the `preprocess` steps widen that to
 * `unknown`, which is unhelpful at the call site.
 *
 * Screens pass these straight from their text fields; the service normalises
 * and validates them with the schemas above.
 */
export type SignUpInput = { displayName: string; email: string; password: string };
export type SignInInput = { email: string; password: string };

/** Which backend authenticated the user. */
export type AuthProvider = 'local' | 'supabase';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

export type AuthSession = {
  user: AuthUser;
  provider: AuthProvider;
  issuedAt: string;
  /** Present for cloud providers only; local accounts have no token. */
  accessToken: string | null;
};

/** First name (or the email prefix) — used for the dashboard greeting. */
export function firstNameOf(user: AuthUser): string {
  if (user.displayName && user.displayName.length > 0) {
    return user.displayName.split(' ')[0];
  }
  return user.email.split('@')[0];
}
