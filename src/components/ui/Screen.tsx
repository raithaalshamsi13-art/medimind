/**
 * Screen wrapper: safe-area handling, themed background, optional scrolling,
 * and a max content width so text lines stay readable on large devices.
 *
 * Every route in app/ renders its content inside a <Screen>.
 */

import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';

export type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Use for forms and long lists of cards. */
  scroll?: boolean;
  /** Horizontal + vertical screen padding. Set false for edge-to-edge lists. */
  padded?: boolean;
  /** Which safe-area edges to inset. Tab screens usually only need the top. */
  edges?: readonly Edge[];
  /** Vertically centre the content (used by splash / empty states). */
  center?: boolean;
  style?: ViewStyle;
  /** Extra bottom padding, e.g. to clear a floating action button. */
  bottomInset?: number;
  /** Lift content above the keyboard. Use on any screen with a text input. */
  keyboardAvoiding?: boolean;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  center = false,
  style,
  bottomInset = 0,
  keyboardAvoiding = false,
}: ScreenProps) {
  const theme = useTheme();

  const contentStyle: ViewStyle = {
    width: '100%',
    maxWidth: theme.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: padded ? theme.layout.screenPadding : 0,
    paddingTop: padded ? theme.spacing.base : 0,
    paddingBottom: (padded ? theme.spacing.xl : 0) + bottomInset,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[contentStyle, center && styles.centerContent]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle, center && styles.centerContent]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: theme.colors.background }, style]}>
      {keyboardAvoiding ? (
        // Android already resizes the window (adjustResize), so only iOS needs
        // an explicit behavior here.
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerContent: { flexGrow: 1, justifyContent: 'center' },
});
