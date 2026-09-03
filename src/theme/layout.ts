/**
 * Spacing, radii and touch-target tokens.
 *
 * Touch targets: `minTarget` (48) is the WCAG / Material floor. MediMind uses
 * `comfortable` (56) for ordinary buttons and `large` (64) for the primary
 * Scan action, because the app targets users with reduced dexterity.
 */

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const touch = {
  /** Absolute minimum tappable size. Never go below this. */
  minTarget: 48,
  /** Default for buttons and list rows. */
  comfortable: 56,
  /** Primary actions (Scan Medicine, Confirm, Taken). */
  large: 64,
} as const;

export const layout = {
  /** Keeps text lines readable on tablets / large phones. */
  maxContentWidth: 640,
  screenPadding: 20,
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Touch = typeof touch;
export type Layout = typeof layout;
