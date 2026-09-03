/**
 * MediMind type scale.
 *
 * Base body size is 17pt (not the usual 14-16) because a core audience is
 * older adults. On top of that, users can turn on "Large text" in Settings,
 * which multiplies every size by LARGE_TEXT_MULTIPLIER.
 *
 * This is independent of the OS font-size setting: RN already honours that via
 * allowFontScaling, so a user who enlarges text at OS level AND in MediMind
 * gets both. That is intentional.
 */

import type { TextStyle } from 'react-native';

export type TypeVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'bodyLarge'
  | 'body'
  | 'label'
  | 'caption'
  | 'button';

export type TypeSpec = {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  letterSpacing?: number;
};

const baseScale: Record<TypeVariant, TypeSpec> = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 21, lineHeight: 27, fontWeight: '700' },
  subheading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  bodyLarge: { fontSize: 19, lineHeight: 27, fontWeight: '400' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  button: { fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: 0.2 },
};

export const LARGE_TEXT_MULTIPLIER = 1.25;

export type TypeScale = Record<TypeVariant, TypeSpec>;

export function createTypeScale(multiplier: number): TypeScale {
  if (multiplier === 1) return baseScale;

  const scaled = {} as TypeScale;
  for (const key of Object.keys(baseScale) as TypeVariant[]) {
    const spec = baseScale[key];
    scaled[key] = {
      ...spec,
      fontSize: Math.round(spec.fontSize * multiplier),
      lineHeight: Math.round(spec.lineHeight * multiplier),
    };
  }
  return scaled;
}
