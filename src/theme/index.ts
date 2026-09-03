/**
 * Theme assembly.
 *
 * A `Theme` is derived from four inputs:
 *   1. the resolved colour scheme (light / dark)
 *   2. the palette the user picked in Settings
 *   3. the "Large text" accessibility preference
 *   4. the "High contrast" accessibility preference
 *
 * Components never hardcode a colour or a font size — they read them off the
 * theme via `useTheme()`. That is what makes a palette switch or an
 * accessibility toggle a one-line change instead of an app-wide refactor.
 */

import { darkHighContrast, lightHighContrast, type ColorTokens } from './colors';
import {
  layout,
  radius,
  spacing,
  touch,
  type Layout,
  type Radius,
  type Spacing,
  type Touch,
} from './layout';
import { DEFAULT_PALETTE_ID, getPalette, type PaletteId } from './palettes';
import { createTypeScale, LARGE_TEXT_MULTIPLIER, type TypeScale } from './typography';

export type ColorScheme = 'light' | 'dark';

export type ThemePreferences = {
  largeText: boolean;
  highContrast: boolean;
  paletteId: PaletteId;
};

export type Theme = {
  scheme: ColorScheme;
  paletteId: PaletteId;
  colors: ColorTokens;
  type: TypeScale;
  spacing: Spacing;
  radius: Radius;
  touch: Touch;
  layout: Layout;
  preferences: ThemePreferences;
};

export function createTheme(scheme: ColorScheme, preferences: ThemePreferences): Theme {
  const palette = getPalette(preferences.paletteId ?? DEFAULT_PALETTE_ID);
  const base = scheme === 'dark' ? palette.dark : palette.light;

  // High contrast is applied ON TOP of whichever palette is selected, so the
  // two settings compose instead of one overriding the other.
  const contrastOverrides = preferences.highContrast
    ? scheme === 'dark'
      ? darkHighContrast
      : lightHighContrast
    : null;

  return {
    scheme,
    paletteId: palette.id,
    colors: contrastOverrides ? { ...base, ...contrastOverrides } : base,
    type: createTypeScale(preferences.largeText ? LARGE_TEXT_MULTIPLIER : 1),
    spacing,
    radius,
    touch,
    layout,
    preferences,
  };
}

export * from './colors';
export * from './layout';
export * from './palettes';
export * from './typography';
