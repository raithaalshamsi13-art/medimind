/**
 * HTML document shell for the WEB build only (Expo Router convention file).
 *
 * Native builds ignore this. It gives the browser tab a title and description
 * and the standard mobile viewport, and applies Expo's scroll-view reset so the
 * root view fills the window the way it does on a phone.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>MediMind</title>
        <meta name="description" content="Check the medicine first. Then remind the user." />
        <meta name="theme-color" content="#DDEDF9" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
