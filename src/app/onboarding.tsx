/**
 * Onboarding — three slides explaining what makes MediMind different.
 *
 * The order mirrors the app's core workflow (scan → check → remind), because
 * the "check" step is the whole point: MediMind verifies the medicine before it
 * schedules anything.
 *
 * Shown once. Completing or skipping it sets `hasCompletedOnboarding`, which is
 * persisted to encrypted storage, and the auth gate in the root layout then
 * moves the user on to login.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand/Logo';
import { AppText, Button, InlineMessage } from '@/components/ui';
import { MEDICAL_DISCLAIMER_SHORT } from '@/config/constants';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme/ThemeContext';

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'scan',
    icon: 'camera-outline',
    title: 'Scan your medicine',
    body: 'Point your camera at the label. MediMind reads the medicine name, the dose, the expiry date and the instructions for you.',
  },
  {
    key: 'check',
    icon: 'shield-checkmark-outline',
    title: 'Check its safety',
    body: 'Before anything is saved, MediMind checks the expiry date and tells you clearly when something could not be read — so you are never guessing.',
  },
  {
    key: 'remind',
    icon: 'alarm-outline',
    title: 'Never forget your reminders',
    body: 'You confirm the schedule, then MediMind reminds you at the right time — with a voice alert if you prefer to listen rather than read.',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const setSetting = useSettingsStore((state) => state.set);

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const isLastSlide = index === SLIDES.length - 1;

  const finish = () => {
    // The auth gate reacts to this and redirects to login.
    setSetting('hasCompletedOnboarding', true);
  };

  const goNext = () => {
    if (isLastSlide) {
      finish();
      return;
    }
    const next = index + 1;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header: brand on the left, Skip on the right */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.layout.screenPadding,
          paddingVertical: theme.spacing.md,
        }}>
        <Logo variant="lockup" size={30} />

        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          hitSlop={12}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.sm }}>
          <AppText variant="label" color="textSecondary">
            Skip
          </AppText>
        </Pressable>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}>
        {SLIDES.map((slide, slideIndex) => (
          <View
            key={slide.key}
            style={{
              width,
              paddingHorizontal: theme.layout.screenPadding,
              justifyContent: 'center',
              gap: theme.spacing.xl,
            }}>
            <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
              <View
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={slide.icon} size={64} color={theme.colors.primary} />
              </View>

              <AppText variant="title" align="center">
                {slide.title}
              </AppText>

              <AppText variant="bodyLarge" color="textSecondary" align="center">
                {slide.body}
              </AppText>
            </View>

            {/* The disclaimer belongs on the last slide, before sign-up. */}
            {slideIndex === SLIDES.length - 1 ? (
              <InlineMessage tone="info" message={MEDICAL_DISCLAIMER_SHORT} />
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Progress dots + primary action */}
      <View
        style={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: theme.spacing.base,
          gap: theme.spacing.lg,
        }}>
        <View
          accessible
          accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.spacing.sm,
          }}>
          {SLIDES.map((slide, dotIndex) => (
            <View
              key={slide.key}
              style={{
                width: dotIndex === index ? 28 : 10,
                height: 10,
                borderRadius: theme.radius.pill,
                backgroundColor:
                  dotIndex === index ? theme.colors.primary : theme.colors.borderStrong,
              }}
            />
          ))}
        </View>

        <Button
          label={isLastSlide ? 'Get started' : 'Next'}
          onPress={goNext}
          size="large"
          icon={isLastSlide ? 'arrow-forward' : undefined}
        />
      </View>
    </SafeAreaView>
  );
}
