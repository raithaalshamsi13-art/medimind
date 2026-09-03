/**
 * Theme plumbing.
 *
 * `AppThemeProvider` does two jobs:
 *   1. exposes the MediMind `Theme` to our own components via `useTheme()`
 *   2. feeds a matching navigation theme to Expo Router, so headers, tab bars
 *      and screen backgrounds match the app instead of using stock colours.
 *
 * Note: in SDK 56+ Expo Router no longer allows importing from
 * `@react-navigation/*` directly — theme primitives come from `expo-router`.
 */

import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/useSettingsStore';

import { createTheme, type ColorScheme, type Theme } from './index';

const ThemeContext = createContext<Theme | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const appearance = useSettingsStore((s) => s.appearance);
  const paletteId = useSettingsStore((s) => s.paletteId);
  const largeText = useSettingsStore((s) => s.largeText);
  const highContrast = useSettingsStore((s) => s.highContrast);

  // "system" follows the phone; otherwise the user's explicit choice wins.
  const scheme: ColorScheme =
    appearance === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance;

  const theme = useMemo(
    () => createTheme(scheme, { largeText, highContrast, paletteId }),
    [scheme, largeText, highContrast, paletteId],
  );

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: scheme === 'dark',
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    };
  }, [scheme, theme]);

  return (
    <ThemeContext.Provider value={theme}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

/** Read the current theme. Throws if used outside AppThemeProvider. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme() must be used inside <AppThemeProvider>.');
  }
  return theme;
}

/**
 * Build themed styles without recreating them on every render.
 *
 * Define the factory at MODULE scope (not inline in the component), otherwise
 * its identity changes each render and the memo does nothing:
 *
 *   const makeStyles = (t: Theme) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
