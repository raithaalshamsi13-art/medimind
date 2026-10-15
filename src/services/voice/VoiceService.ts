/**
 * Voice alerts (Phase 13) — text-to-speech through `expo-speech`, which uses
 * the phone's built-in voices (and the browser's on the web). Nothing is
 * downloaded, nothing leaves the device.
 *
 * QUALITY
 *   - The best installed voice for the language is chosen once per language
 *     (an "Enhanced" / premium / neural voice when the phone has one, else
 *     the default for that locale), so speech is as natural as the device
 *     allows. iOS ships enhanced English and Arabic voices; Android depends on
 *     the Google TTS data installed; the browser uses the OS voices.
 *   - Text is spoken one sentence at a time with a short pause between
 *     sentences, so nothing is cut off and the pacing sounds natural.
 *   - A new `speak` always stops whatever was playing first.
 *
 * LIMITATION, stated honestly: a phone will not let an app speak while it is
 * closed or the screen is locked. So the notification sound is the alert
 * that always arrives; the voice plays when the reminder fires with MediMind
 * open, or when the user opens it from the notification. Settings says so.
 */

import * as Speech from 'expo-speech';

import type { Language } from '@/i18n';

import { splitIntoSentences } from './sentences';
import { speakable } from './speakable';

const VOICE_LOCALES: Record<Language, string> = { en: 'en-GB', ar: 'ar-SA' };
/** Any voice whose language starts with this is acceptable for the language. */
const LANGUAGE_PREFIX: Record<Language, string> = { en: 'en', ar: 'ar' };
/** Slightly under normal speed reads clearly without dragging. */
const RATE: Record<Language, number> = { en: 0.95, ar: 0.9 };
const PAUSE_BETWEEN_SENTENCES_MS = 220;

export interface VoiceService {
  readonly isAvailable: boolean;
  /** Stops anything already playing, then speaks. Resolves when speech ends or is stopped. */
  speak(text: string, language: Language): Promise<void>;
  stop(): void;
}

type Voice = { identifier: string; name: string; quality: string; language: string };

/** Score a voice for a language: enhanced / premium / neural first, then exact locale, then any match. */
function scoreVoice(voice: Voice, language: Language): number {
  const lang = voice.language.toLowerCase().replace('_', '-');
  if (!lang.startsWith(LANGUAGE_PREFIX[language])) return -1;
  let score = 1;
  if (lang === VOICE_LOCALES[language].toLowerCase()) score += 2;
  if (language === 'en' && (lang === 'en-us' || lang === 'en-gb')) score += 1;
  const label = `${voice.name} ${voice.identifier} ${voice.quality}`.toLowerCase();
  if (/enhanced|premium|neural|natural|wavenet|siri/.test(label)) score += 4;
  if (/compact|espeak/.test(label)) score -= 1;
  return score;
}

export class ExpoVoiceService implements VoiceService {
  readonly isAvailable = true;

  private voiceFor: Partial<Record<Language, string | null>> = {};
  /** Incremented by `stop()` and by every new `speak()`, so a stale run ends itself. */
  private run = 0;

  private async pickVoice(language: Language): Promise<string | undefined> {
    if (language in this.voiceFor) return this.voiceFor[language] ?? undefined;
    let chosen: string | null = null;
    try {
      const voices = (await Speech.getAvailableVoicesAsync()) as Voice[];
      let best = -1;
      for (const voice of voices) {
        const score = scoreVoice(voice, language);
        if (score > best) {
          best = score;
          chosen = voice.identifier;
        }
      }
    } catch {
      // Voice listing is unavailable (some web engines): the locale alone is fine.
    }
    this.voiceFor[language] = chosen;
    return chosen ?? undefined;
  }

  private speakOne(text: string, language: Language, voice: string | undefined): Promise<void> {
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: VOICE_LOCALES[language],
        voice,
        rate: RATE[language],
        pitch: 1,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }

  async speak(text: string, language: Language): Promise<void> {
    const sentences = splitIntoSentences(speakable(text, language));
    if (sentences.length === 0) return;

    const myRun = ++this.run;
    await Speech.stop().catch(() => {});
    const voice = await this.pickVoice(language);

    for (const sentence of sentences) {
      if (myRun !== this.run) return; // stopped, or a newer announcement started
      await this.speakOne(sentence, language, voice);
      if (myRun !== this.run) return;
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_SENTENCES_MS));
    }
  }

  stop(): void {
    this.run += 1;
    void Speech.stop().catch(() => {});
  }
}

let service: VoiceService | null = null;

export function getVoiceService(): VoiceService {
  service ??= new ExpoVoiceService();
  return service;
}
