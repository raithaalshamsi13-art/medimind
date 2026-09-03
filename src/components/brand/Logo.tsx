/**
 * The MediMind logo — the ONLY place the brand mark is drawn.
 *
 * Every screen renders <Logo/> rather than assembling an icon and a text label
 * itself. That means replacing the placeholder with the real artwork is a
 * change to this one file, and every screen updates at once.
 *
 * ---------------------------------------------------------------------------
 * CURRENT STATE: placeholder mark (a capsule glyph on a brand-navy tile).
 *
 * TO INSTALL THE REAL LOGO — see the "SWAP HERE" block in LogoMark below.
 * ---------------------------------------------------------------------------
 *
 * Variants:
 *   mark     the square capsule tile on its own (tab bars, small headers)
 *   lockup   mark + "MEDIMIND" side by side (login, onboarding header)
 *   stacked  mark above "MEDIMIND", centred (splash, About)
 */

import { Image } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui';
import { APP_LOGO_TAGLINE, APP_NAME } from '@/config/constants';
import { BRAND } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeContext';

export type LogoVariant = 'mark' | 'lockup' | 'stacked';

export type LogoProps = {
  variant?: LogoVariant;
  /** Height of the square mark in points. Text scales proportionally. */
  size?: number;
  /** Show "Health & Medication Reminder" beneath the wordmark. */
  showTagline?: boolean;
  style?: ViewStyle;
};

/**
 * The square brand tile: the capsule-and-brain artwork on a white ground.
 *
 * The tile stays white in BOTH light and dark mode rather than following the
 * theme, for two reasons:
 *   - the capsule is drawn with a navy outline, which would disappear against
 *     a dark surface if the tile went dark with it
 *   - white is what hides the soft glow baked into the original artwork; the
 *     glow's pixels are near-white, so on white they are invisible
 *
 * It used to be pale blue, but that is now the app background — the tile would
 * have dissolved into the screen.
 *
 * `logo-mark.png` is generated from the supplied logo lockup: cropped to the
 * mark's bounding box and colour-keyed to transparency.
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="MediMind logo"
      style={{
        width: size,
        height: size,
        // 0.28 keeps the corner radius proportional at every size.
        borderRadius: size * 0.28,
        backgroundColor: BRAND.white,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: size * 0.86, height: size * 0.86 }}
        contentFit="contain"
      />
    </View>
  );
}

/**
 * "MEDIMIND" set in heavy, letter-spaced caps, as in the logo.
 *
 * The wordmark is drawn as TEXT rather than taken from the logo image for two
 * reasons: the artwork's lettering is black and would be invisible in dark
 * mode, and text stays sharp at any size.
 *
 * Note it uses fixed proportions of `size` instead of the themed type scale,
 * so it does NOT grow with the "Large text" accessibility setting. That is
 * intentional — a logo is a brand element, and the tagline is decorative: the
 * same description appears as real, scalable text on the About screen.
 */
function Wordmark({ size, showTagline }: { size: number; showTagline: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ gap: size * 0.06 }}>
      <AppText
        variant="title"
        style={{
          fontSize: size * 0.54,
          lineHeight: size * 0.64,
          fontWeight: '800',
          letterSpacing: size * 0.04,
        }}>
        {APP_NAME.toUpperCase()}
      </AppText>

      {showTagline ? (
        <AppText
          variant="caption"
          color="textMuted"
          style={{
            // 0.17 matches the wordmark-to-tagline ratio in the artwork; the
            // floor of 10 stops it becoming unreadable at small sizes.
            fontSize: Math.max(10, size * 0.17),
            letterSpacing: size * 0.025,
            fontWeight: '600',
          }}>
          {APP_LOGO_TAGLINE.toUpperCase()}
        </AppText>
      ) : null}
    </View>
  );
}

export function Logo({
  variant = 'mark',
  size = 48,
  showTagline = false,
  style,
}: LogoProps) {
  const theme = useTheme();

  if (variant === 'mark') {
    return (
      <View style={style}>
        <LogoMark size={size} />
      </View>
    );
  }

  if (variant === 'stacked') {
    return (
      <View style={[{ alignItems: 'center', gap: theme.spacing.md }, style]}>
        <LogoMark size={size} />
        <View style={{ alignItems: 'center' }}>
          <Wordmark size={size} showTagline={showTagline} />
        </View>
      </View>
    );
  }

  // lockup
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: size * 0.22 },
        style,
      ]}>
      <LogoMark size={size} />
      <Wordmark size={size} showTagline={showTagline} />
    </View>
  );
}
