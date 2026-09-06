/**
 * App-wide user preferences, persisted to encrypted device storage.
 *
 * These are read on every launch before the splash screen is hidden, so the
 * app never flashes the wrong text size or replays onboarding.
 */

import { create } from 'zustand';

import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';
import { DEFAULT_PALETTE_ID, PALETTES, type PaletteId } from '@/theme/palettes';

/** Follow the phone's setting, or force one appearance. */
export type AppearancePreference = 'system' | 'light' | 'dark';

export type SettingsFlags = {
  /** Master switch for medication reminder notifications. */
  notificationsEnabled: boolean;
  /** Text-to-speech for reminders and safety warnings (Phase 13). */
  voiceAlertsEnabled: boolean;
  /** Multiplies the whole type scale by 1.25 (Phase 16). */
  largeText: boolean;
  /** Pure black/white text + heavier borders (Phase 16). */
  highContrast: boolean;
  /** Set once the user finishes the 3 onboarding slides. */
  hasCompletedOnboarding: boolean;
  /**
   * Demo mode routes scanning through MockMedicationScanner instead of the
   * real AI service (Phase 19). Defaults on so the app is fully demonstrable
   * before any API key exists.
   */
  demoMode: boolean;
  /** Light / dark / follow the system. */
  appearance: AppearancePreference;
  /** Which colour palette from `theme/palettes.ts` is in use. */
  paletteId: PaletteId;
  /** User has read and accepted the assistant's "not medical advice" notice. */
  assistantDisclaimerAcknowledged: boolean;
};

const defaultFlags: SettingsFlags = {
  notificationsEnabled: true,
  voiceAlertsEnabled: true,
  largeText: false,
  highContrast: false,
  hasCompletedOnboarding: false,
  demoMode: true,
  appearance: 'system',
  paletteId: DEFAULT_PALETTE_ID,
  assistantDisclaimerAcknowledged: false,
};

/** Keys whose value is a boolean — all of them today, kept honest by types. */
type BooleanFlag = {
  [K in keyof SettingsFlags]: SettingsFlags[K] extends boolean ? K : never;
}[keyof SettingsFlags];

type SettingsState = SettingsFlags & {
  /** True once preferences have been read from storage. */
  isHydrated: boolean;

  /** Run once on app launch, before the splash screen is hidden. */
  load: () => Promise<void>;
  set: <K extends keyof SettingsFlags>(key: K, value: SettingsFlags[K]) => void;
  toggle: (key: BooleanFlag) => void;
  reset: () => void;
};

/** Strip the actions off the state so only real preferences are persisted. */
function pickFlags(state: SettingsFlags): SettingsFlags {
  return {
    notificationsEnabled: state.notificationsEnabled,
    voiceAlertsEnabled: state.voiceAlertsEnabled,
    largeText: state.largeText,
    highContrast: state.highContrast,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    demoMode: state.demoMode,
    appearance: state.appearance,
    paletteId: state.paletteId,
    assistantDisclaimerAcknowledged: state.assistantDisclaimerAcknowledged,
  };
}

/** Guard against a stored palette id that no longer exists in the app. */
function sanitise(values: Partial<SettingsFlags>): Partial<SettingsFlags> {
  if (values.paletteId && !PALETTES[values.paletteId]) {
    return { ...values, paletteId: DEFAULT_PALETTE_ID };
  }
  return values;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  /**
   * Fire-and-forget write. Preferences are cosmetic enough that a failed save
   * should not interrupt the user; the in-memory value still applies for this
   * session.
   */
  const persist = () => {
    void writeJson(STORAGE_KEYS.preferences, pickFlags(get()));
  };

  return {
    ...defaultFlags,
    isHydrated: false,

    load: async () => {
      const stored = await readJson<Partial<SettingsFlags>>(STORAGE_KEYS.preferences);
      if (stored.ok && stored.value) {
        // Spread defaults first so a preference added in a later version gets
        // its default instead of becoming undefined.
        set({ ...defaultFlags, ...sanitise(stored.value), isHydrated: true });
        return;
      }
      set({ isHydrated: true });
    },

    set: (key, value) => {
      set({ [key]: value } as Pick<SettingsFlags, typeof key>);
      persist();
    },

    toggle: (key) => {
      set((state) => ({ [key]: !state[key] }) as Pick<SettingsFlags, typeof key>);
      persist();
    },

    reset: () => {
      set({ ...defaultFlags });
      persist();
    },
  };
});
