/**
 * JavaScript side of the on-device label reader (Apple Vision, iOS).
 *
 * The native module exists only in the MediMind development build. In Expo
 * Go, on Android and on the web `requireOptionalNativeModule` returns null
 * and `isLabelOcrAvailable()` is false — the scanner factory then uses the
 * server reader (or explains that neither is available). Nothing here ever
 * pretends a reading happened.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type OcrLine = {
  text: string;
  /** 0–1, Vision's confidence for the line. */
  confidence: number;
  /** Normalised position, origin top-left; `height` is the text height as a fraction of the image. */
  x: number;
  y: number;
  width: number;
  height: number;
};

type LabelOcrNative = {
  supportedLanguages?: string[];
  recognize(uri: string, languages: string[]): Promise<{ lines: OcrLine[] }>;
};

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<LabelOcrNative>('LabelOcr') : null;

export function isLabelOcrAvailable(): boolean {
  return native !== null;
}

/** Recognition languages Vision supports on this phone (empty when the module is absent). */
export function supportedOcrLanguages(): string[] {
  return native?.supportedLanguages ?? [];
}

/** Recognise printed text in a local photo file. Throws when the module is absent. */
export async function recognizeLabelText(uri: string, languages: string[]): Promise<OcrLine[]> {
  if (!native) throw new Error('LabelOcr native module is not available in this build');
  const { lines } = await native.recognize(uri, languages);
  return lines;
}
