/**
 * MediMind color tokens.
 *
 * BRAND SOURCE — taken from the MediMind logo (capsule + neural network):
 *   navy      #17255A  capsule outline and wordmark  → primary actions
 *   node blue #2E7FD4  the network nodes             → informational accent
 *   pill red  #D32F27  the lower half of the capsule → alerts and warnings
 *   pale blue #E9F2FB  the logo's background         → app background tint
 *
 * Navy is the primary action colour rather than the brighter node blue for an
 * accessibility reason: white text on navy reaches roughly 14:1 contrast, while
 * white on #2E7FD4 is only about 3.6:1 — below the 4.5:1 minimum for body text.
 * The node blue is therefore used for icons, borders and the `info` state,
 * never as a background for small white text.
 *
 * The brand red doubles as the `danger` colour. That is deliberate: it means
 * the expired-medicine warning in Phase 7 looks like part of the brand instead
 * of a bolted-on alert. Note `danger` (fills and icons) is separate from
 * `dangerText` (a darker red that stays readable on `dangerSoft`).
 *
 * ACCESSIBILITY RULE (Phase 16): color never carries meaning on its own.
 * Every safety state in this app also ships a written label and an icon.
 * These tokens only *reinforce* a message that is already spelled out in text.
 *
 * Naming convention:
 *   <role>       strong fill / icon / border colour
 *   <role>Text   text colour that is readable on top of <role>Soft
 *   <role>Soft   tinted background for banners and pills
 */

/** Raw brand colours. Use the semantic tokens below in components. */
export const BRAND = {
  navy: '#17255A',
  nodeBlue: '#2E7FD4',
  pillRed: '#D32F27',
  /** Exact panel colour sampled from the supplied logo artwork. */
  paleBlue: '#DFEDF8',
  white: '#FFFFFF',
} as const;

export type ColorTokens = {
  // Surfaces
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Brand / primary action
  primary: string;
  primaryPressed: string;
  primaryText: string;
  primarySoft: string;

  // Semantic states
  danger: string;
  dangerText: string;
  dangerSoft: string;
  warning: string;
  warningText: string;
  warningSoft: string;
  success: string;
  successText: string;
  successSoft: string;
  info: string;
  infoText: string;
  infoSoft: string;

  // Utility
  overlay: string;
  focusRing: string;
  skeleton: string;
};

// The palettes themselves live in `./palettes.ts`, which the user can choose
// between in Settings. This file owns only the shape, the brand constants and
// the accessibility overrides below.

/**
 * High-contrast overrides, applied on top of the base palette when the user
 * turns on "High contrast" in Settings. We push text to pure black/white and
 * darken borders so edges are unmistakable.
 */
export const lightHighContrast: Partial<ColorTokens> = {
  // High contrast drops the pale-blue ground for plain white: brand identity
  // matters less than legibility for someone who has asked for this mode.
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF1F4',
  border: '#5B6B80',
  borderStrong: '#000000',
  text: '#000000',
  textSecondary: '#111C2E',
  textMuted: '#2B3849',
  primary: '#0F1A45',
  dangerText: '#7F1109',
  warningText: '#5C2C04',
  successText: '#0B3D20',
  infoText: '#123C73',
};

export const darkHighContrast: Partial<ColorTokens> = {
  background: '#000000',
  surface: '#080C16',
  surfaceAlt: '#161D2E',
  border: '#9AA9BF',
  borderStrong: '#FFFFFF',
  text: '#FFFFFF',
  textSecondary: '#E5EAF2',
  textMuted: '#CBD4E1',
  primary: '#B9D3F7',
  dangerText: '#FFE5E2',
  warningText: '#FFEDC7',
  successText: '#DDF7E5',
  infoText: '#E7F0FE',
};
