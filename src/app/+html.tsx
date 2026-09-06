/**
 * HTML document shell for the WEB build only (Expo Router convention file).
 *
 * Native builds ignore this. Beyond the title and description it does the
 * work needed for "Add to Home Screen" on an iPhone to behave like an app:
 *
 *   - `viewport-fit=cover` lets the page extend under the notch and the home
 *     indicator, and makes iOS report those areas as safe-area insets. Without
 *     it, react-native-safe-area-context sees zero insets in standalone mode
 *     and the bottom tab bar sits underneath the home indicator.
 *   - `apple-mobile-web-app-*` metas make Safari open the saved site full
 *     screen with a native-looking status bar and the right title.
 *   - `apple-touch-icon` + `manifest.json` (served from /public) give the home
 *     screen the real MediMind icon instead of a screenshot.
 *   - The root is sized with `100dvh` (dynamic viewport height). Expo's reset
 *     uses `height: 100%`, which on iOS Safari measures the FULL screen even
 *     when the browser toolbar or home indicator covers the bottom of it, so
 *     the tab bar ended up partly off-screen. `dvh` tracks the visible area.
 *   - The html/body background matches the app's pale blue so the areas behind
 *     the notch and the overscroll bounce never flash white.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const BACKGROUND = '#DFEDF8';

const WEB_CSS = `
  html, body {
    background-color: ${BACKGROUND};
    overscroll-behavior: none;
  }
  body {
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
  }
  /* Size the app to the VISIBLE viewport, not the full screen. Older iOS
     falls back to -webkit-fill-available; modern browsers use dvh. */
  html, body, #root {
    height: 100%;
    min-height: -webkit-fill-available;
  }
  @supports (height: 100dvh) {
    html, body, #root {
      height: 100dvh;
      min-height: 100dvh;
    }
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <title>MediMind</title>
        <meta name="description" content="Check the medicine first. Then remind the user." />
        <meta name="theme-color" content={BACKGROUND} />

        {/* iOS "Add to Home Screen" */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MediMind" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Expo's reset first, then our overrides so they win the cascade. */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: WEB_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
