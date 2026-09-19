/**
 * "MediMind is typing…" — three pulsing dots beside the assistant's mark,
 * shown while a reply is on its way. Paired with a written label so the
 * state is never conveyed by animation alone.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { LogoMark } from '@/components/brand/Logo';
import { AppText } from '@/components/ui';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export function TypingIndicator({ label: labelProp }: { label?: string }) {
  const theme = useTheme();
  const { t } = useT();
  const label = labelProp ?? t('assistant.typing');
  const dots = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;

  useEffect(() => {
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(600 - delay),
        ]),
      );
    const animations = dots.map((value, index) => pulse(value, index * 150));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
      <LogoMark size={28} />
      <View style={{ gap: theme.spacing.xs }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.xl,
            borderBottomLeftRadius: theme.radius.sm,
            paddingHorizontal: theme.spacing.base,
            paddingVertical: theme.spacing.md,
            minHeight: 44,
          }}>
          {dots.map((opacity, index) => (
            <Animated.View
              key={index}
              style={{
                width: 8,
                height: 8,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primary,
                opacity,
              }}
            />
          ))}
        </View>
        <AppText variant="caption" color="textMuted" style={{ paddingHorizontal: theme.spacing.xs }}>
          {label}
        </AppText>
      </View>
    </View>
  );
}
