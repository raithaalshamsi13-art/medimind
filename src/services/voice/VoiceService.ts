/**
 * Voice alerts (Phase 13) — text-to-speech through `expo-speech`, which uses
 * the phone's built-in voices (and the browser's on the web). Nothing is
 * downloaded, nothing leaves the device.
 *
 * LIMITATION, stated honestly: a phone will not let an app speak while it is
 * closed or the screen is locked. So the notification sound is the alert
 * that always arrives; the voice plays when the reminder fires with MediMind
 * open, or when the user opens it from the notification. Settings says so.
 */

import * as Speech from 'expo-speech';

import type { Language } from '@/i18n';

const VOICE_LOCALES: Record<Language, string> = { en: 'en-GB', ar: 'ar-SA' };

export interface VoiceService {
  readonly isAvailable: boolean;
  /** Stops anything already playing, then speaks. Resolves when speech ends. */
  speak(text: string, language: Language): Promise<void>;
  stop(): void;
}

export class ExpoVoiceService implements VoiceService {
  readonly isAvailable = true;

  async speak(text: string, language: Language): Promise<void> {
    if (text.trim().length === 0) return;
    await Speech.stop();
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: VOICE_LOCALES[language],
        rate: 0.92,
        pitch: 1,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }

  stop(): void {
    void Speech.stop();
  }
}

let service: VoiceService | null = null;

export function getVoiceService(): VoiceService {
  service ??= new ExpoVoiceService();
  return service;
}
