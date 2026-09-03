/**
 * WCAG contrast checker for every MediMind palette.
 *
 * Scans `src/theme/colors.ts` and `src/theme/palettes.ts` for
 * `export const <name>: ColorTokens = { ... }` literals and verifies each one.
 * Reading the real source (rather than duplicating hex values here) means the
 * check can never drift away from what the app actually renders.
 *
 * Thresholds:
 *   4.5:1  normal-size text                     (WCAG 2.1 AA, 1.4.3)
 *   3.0:1  UI component boundaries and dividers (WCAG 2.1 AA, 1.4.11)
 *
 * Run after changing any colour, or after adding a palette:
 *     npm run check:contrast
 *
 * Exits non-zero on failure, so it can gate a commit.
 */

const fs = require('fs');
const path = require('path');

const THEME_DIR = path.join(__dirname, '..', 'src', 'theme');
const SOURCE_FILES = ['colors.ts', 'palettes.ts'].map((f) => path.join(THEME_DIR, f));

/** Resolve `BRAND.navy` style references from anywhere in the theme sources. */
function buildBrandMap(sources) {
  const brand = {};
  for (const source of sources) {
    const start = source.indexOf('export const BRAND');
    if (start === -1) continue;
    const block = source.slice(start, source.indexOf('} as const', start));
    for (const match of block.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
      brand[match[1]] = match[2];
    }
  }
  return brand;
}

/** Extract every `export const X: ColorTokens = {...}` literal. */
function extractPalettes(source, brand) {
  const palettes = [];
  const pattern = /export const (\w+): ColorTokens = \{/g;

  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    const start = match.index + match[0].length;
    const block = source.slice(start, source.indexOf('\n};', start));

    const colors = {};
    for (const entry of block.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
      colors[entry[1]] = entry[2];
    }
    for (const entry of block.matchAll(/(\w+):\s*BRAND\.(\w+)/g)) {
      if (brand[entry[2]]) colors[entry[1]] = brand[entry[2]];
    }

    palettes.push({ name, colors });
  }
  return palettes;
}

/** sRGB channel → linear light. */
function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  return (
    0.2126 * channel(parseInt(hex.slice(1, 3), 16)) +
    0.7152 * channel(parseInt(hex.slice(3, 5), 16)) +
    0.0722 * channel(parseInt(hex.slice(5, 7), 16))
  );
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground token, background token, minimum ratio, where it appears] */
const CHECKS = [
  ['text', 'background', 4.5, 'body text on the app background'],
  ['textSecondary', 'background', 4.5, 'secondary text on the background'],
  ['textMuted', 'background', 4.5, 'captions on the background'],
  ['text', 'surface', 4.5, 'body text on a card'],
  ['textSecondary', 'surface', 4.5, 'secondary text on a card'],
  ['textMuted', 'surface', 4.5, 'captions on a card'],
  ['primary', 'background', 4.5, 'links and icons on the background'],
  ['primary', 'surface', 4.5, 'links and icons on a card'],
  ['primaryText', 'primary', 4.5, 'label on a primary button'],
  ['borderStrong', 'surface', 3.0, 'input outline on a card'],
  ['borderStrong', 'background', 3.0, 'divider on the background'],
  ['dangerText', 'dangerSoft', 4.5, 'error banner text'],
  ['warningText', 'warningSoft', 4.5, 'warning banner text'],
  ['successText', 'successSoft', 4.5, 'success banner text'],
  ['infoText', 'infoSoft', 4.5, 'info banner text'],
];

const sources = SOURCE_FILES.map((file) => fs.readFileSync(file, 'utf8'));
const brand = buildBrandMap(sources);
const palettes = sources.flatMap((source) => extractPalettes(source, brand));

if (palettes.length === 0) {
  console.error('No ColorTokens palettes found — has the file structure changed?');
  process.exit(1);
}

let totalFailures = 0;

for (const palette of palettes) {
  const failures = [];

  for (const [fg, bg, minimum, description] of CHECKS) {
    if (!palette.colors[fg] || !palette.colors[bg]) {
      failures.push(`  MISSING TOKEN  ${fg} / ${bg}`);
      continue;
    }

    const ratio = contrast(palette.colors[fg], palette.colors[bg]);
    if (ratio < minimum) {
      failures.push(
        `  FAIL ${ratio.toFixed(2).padStart(5)}:1 (min ${minimum.toFixed(1)})  ` +
          `${fg} on ${bg} — ${description}`,
      );
    }
  }

  totalFailures += failures.length;
  if (failures.length === 0) {
    console.log(`PASS  ${palette.name} — all ${CHECKS.length} checks`);
  } else {
    console.log(`FAIL  ${palette.name} — ${failures.length} of ${CHECKS.length} checks`);
    failures.forEach((line) => console.log(line));
  }
}

console.log(
  totalFailures === 0
    ? `\nAll ${palettes.length} palettes pass WCAG AA.`
    : `\n${totalFailures} contrast check(s) FAILED across ${palettes.length} palettes.`,
);

process.exit(totalFailures === 0 ? 0 : 1);
