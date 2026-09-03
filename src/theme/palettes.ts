/**
 * Selectable colour palettes.
 *
 * Each palette is a complete `ColorTokens` set for light and for dark. They are
 * written out in full rather than derived from a base, for two reasons:
 *   1. every value is auditable at a glance, and
 *   2. `scripts/check-contrast.js` can find and verify each one, because it
 *      scans for `export const <name>: ColorTokens = {` literals.
 *
 * Adding a palette therefore means adding two literals and one registry entry —
 * and then running `npm run check:contrast`, which will refuse anything that
 * drops below WCAG AA.
 *
 * Convention: the dark variants share a common structure and differ mainly in
 * their accent colours, because a dark background should stay near-neutral
 * whatever the accent is — a strongly tinted dark background reduces the
 * contrast available for text.
 */

import type { ColorTokens } from './colors';
import { BRAND } from './colors';

// ---------------------------------------------------------------------------
// 1. MediMind Blue — the brand palette, taken from the logo
// ---------------------------------------------------------------------------

export const medimindLight: ColorTokens = {
  background: BRAND.paleBlue,
  surface: '#FFFFFF',
  surfaceAlt: '#EDF5FC',
  border: '#C3DCEF',
  borderStrong: '#5686B4',

  text: '#0E1A2B',
  textSecondary: '#3D5570',
  textMuted: '#4F6884',

  primary: BRAND.navy,
  primaryPressed: '#0F1A45',
  primaryText: '#FFFFFF',
  primarySoft: '#C9DDF3',

  danger: BRAND.pillRed,
  dangerText: '#9C1C16',
  dangerSoft: '#FCE4E1',

  warning: '#B45309',
  warningText: '#7A3B06',
  warningSoft: '#FBEBD5',

  success: '#166534',
  successText: '#12522B',
  successSoft: '#DAF0E2',

  info: BRAND.nodeBlue,
  infoText: '#17457E',
  infoSoft: '#C7DDF7',

  overlay: 'rgba(10, 22, 40, 0.55)',
  focusRing: BRAND.nodeBlue,
  skeleton: '#CFE0EE',
};

export const medimindDark: ColorTokens = {
  background: '#0A1020',
  surface: '#121B33',
  surfaceAlt: '#1B2645',
  border: '#2C3A5E',
  borderStrong: '#6E82A8',

  text: '#F1F5FB',
  textSecondary: '#B4C1D6',
  textMuted: '#94A5BE',

  primary: '#7FAEEA',
  primaryPressed: '#6795D2',
  primaryText: '#0A142E',
  primarySoft: '#16224A',

  danger: '#F5B4AF',
  dangerText: '#FFDAD6',
  dangerSoft: '#4D1512',

  warning: '#F5C77E',
  warningText: '#FFE0A6',
  warningSoft: '#4A3005',

  success: '#8FD9A8',
  successText: '#C6F2D3',
  successSoft: '#123A22',

  info: '#A8C7FA',
  infoText: '#D6E4FD',
  infoSoft: '#13294F',

  overlay: 'rgba(0, 0, 0, 0.65)',
  focusRing: '#7FAEEA',
  skeleton: '#1B2645',
};

// ---------------------------------------------------------------------------
// 2. Clean White — a near-white clinical look for anyone who finds the blue
//    ground too strong
// ---------------------------------------------------------------------------

export const cleanLight: ColorTokens = {
  background: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#ECF0F6',
  border: '#DBE2EC',
  borderStrong: '#5686B4',

  text: '#0E1A2B',
  textSecondary: '#3D5570',
  textMuted: '#4F6884',

  primary: BRAND.navy,
  primaryPressed: '#0F1A45',
  primaryText: '#FFFFFF',
  primarySoft: '#DDE5F4',

  danger: BRAND.pillRed,
  dangerText: '#9C1C16',
  dangerSoft: '#FDEBE9',

  warning: '#B45309',
  warningText: '#7A3B06',
  warningSoft: '#FDF1E2',

  success: '#166534',
  successText: '#12522B',
  successSoft: '#E4F3E9',

  info: BRAND.nodeBlue,
  infoText: '#17457E',
  infoSoft: '#E3EDFB',

  overlay: 'rgba(14, 26, 43, 0.55)',
  focusRing: BRAND.nodeBlue,
  skeleton: '#E4E9F1',
};

export const cleanDark: ColorTokens = {
  background: '#0C1116',
  surface: '#151D26',
  surfaceAlt: '#1F2933',
  border: '#2E3A47',
  borderStrong: '#77899A',

  text: '#F2F5F8',
  textSecondary: '#B6C2CE',
  textMuted: '#9CADBB',

  primary: '#8FB6EA',
  primaryPressed: '#749BD0',
  primaryText: '#0A1526',
  primarySoft: '#182533',

  danger: '#F5B4AF',
  dangerText: '#FFDAD6',
  dangerSoft: '#4D1512',

  warning: '#F5C77E',
  warningText: '#FFE0A6',
  warningSoft: '#4A3005',

  success: '#8FD9A8',
  successText: '#C6F2D3',
  successSoft: '#123A22',

  info: '#A8C7FA',
  infoText: '#D6E4FD',
  infoSoft: '#13294F',

  overlay: 'rgba(0, 0, 0, 0.65)',
  focusRing: '#8FB6EA',
  skeleton: '#1F2933',
};

// ---------------------------------------------------------------------------
// 3. Calm Mint — a softer green-teal alternative
// ---------------------------------------------------------------------------

export const mintLight: ColorTokens = {
  background: '#E4F2EE',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF7F4',
  border: '#C4DFD8',
  borderStrong: '#4E9184',

  text: '#0C1F1B',
  textSecondary: '#35544D',
  textMuted: '#45645C',

  primary: '#0F5C55',
  primaryPressed: '#0A4741',
  primaryText: '#FFFFFF',
  primarySoft: '#C3E6DE',

  danger: BRAND.pillRed,
  dangerText: '#9C1C16',
  dangerSoft: '#FBE6E3',

  warning: '#B45309',
  warningText: '#7A3B06',
  warningSoft: '#FAEDD8',

  success: '#166534',
  successText: '#12522B',
  successSoft: '#D8EFE0',

  info: '#1F6F8B',
  infoText: '#134B60',
  infoSoft: '#D9EBF2',

  overlay: 'rgba(8, 26, 23, 0.55)',
  focusRing: '#0F5C55',
  skeleton: '#CFE3DD',
};

export const mintDark: ColorTokens = {
  background: '#0A1512',
  surface: '#12211D',
  surfaceAlt: '#1B2C27',
  border: '#2C4039',
  borderStrong: '#6C8F85',

  text: '#EFF6F3',
  textSecondary: '#B2C7C0',
  textMuted: '#97ADA6',

  primary: '#6FD5C4',
  primaryPressed: '#55B9A9',
  primaryText: '#062B26',
  primarySoft: '#10352F',

  danger: '#F5B4AF',
  dangerText: '#FFDAD6',
  dangerSoft: '#4D1512',

  warning: '#F5C77E',
  warningText: '#FFE0A6',
  warningSoft: '#4A3005',

  success: '#8FD9A8',
  successText: '#C6F2D3',
  successSoft: '#123A22',

  info: '#8FCBDF',
  infoText: '#CDE8F2',
  infoSoft: '#0F3040',

  overlay: 'rgba(0, 0, 0, 0.65)',
  focusRing: '#6FD5C4',
  skeleton: '#1B2C27',
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PALETTE_IDS = ['medimind', 'clean', 'mint'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export type Palette = {
  id: PaletteId;
  /** Shown in Settings. */
  name: string;
  /** One line explaining who it suits. */
  description: string;
  /** Two colours used to draw the swatch in the Settings picker. */
  swatch: readonly [string, string];
  light: ColorTokens;
  dark: ColorTokens;
};

export const PALETTES: Record<PaletteId, Palette> = {
  medimind: {
    id: 'medimind',
    name: 'MediMind Blue',
    description: 'The logo palette — pale blue with white cards.',
    swatch: [BRAND.paleBlue, BRAND.navy],
    light: medimindLight,
    dark: medimindDark,
  },
  clean: {
    id: 'clean',
    name: 'Clean White',
    description: 'A plain near-white background, if the blue feels too strong.',
    swatch: ['#F7F9FC', BRAND.navy],
    light: cleanLight,
    dark: cleanDark,
  },
  mint: {
    id: 'mint',
    name: 'Calm Mint',
    description: 'A soft green-teal alternative.',
    swatch: ['#E4F2EE', '#0F5C55'],
    light: mintLight,
    dark: mintDark,
  },
};

export const DEFAULT_PALETTE_ID: PaletteId = 'medimind';

/** Look up a palette, falling back to the default if the id is unknown. */
export function getPalette(id: string): Palette {
  return PALETTES[id as PaletteId] ?? PALETTES[DEFAULT_PALETTE_ID];
}

export const PALETTE_LIST: Palette[] = PALETTE_IDS.map((id) => PALETTES[id]);
