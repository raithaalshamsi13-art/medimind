/**
 * Demo-mode fixtures (Phase 19).
 *
 * These exist so the graduation demonstration never depends on remembering or
 * typing credentials in front of an audience. They are NOT a backdoor:
 *
 *   - the account is created through the normal sign-up path, on the device,
 *     the first time "Use demo account" is pressed — nothing is pre-seeded
 *   - the button is only rendered while `demoMode` is on
 *   - the credentials are printed on screen next to the button, so there is
 *     nothing secret about them and nothing to leak
 *
 * When the app moves to a real backend, demo mode is switched off and this
 * account is simply an ordinary local account like any other.
 */

export const DEMO_ACCOUNT = {
  displayName: 'Demo User',
  email: 'demo@medimind.app',
  password: 'medimind123',
} as const;
