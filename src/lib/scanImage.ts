/**
 * Photos for the scanner: make them small enough to send, and keep the one
 * that was read with the medicine.
 *
 * prepareScanImage — a phone camera photo is 8–12 megapixels and several
 *   megabytes; as base64 that can exceed the server's limit and the request
 *   dies with a bare "network request failed" (which used to read as
 *   "offline"). Label text is perfectly legible at 1600 px on the long side,
 *   so the photo is resized and re-encoded (JPEG, 0.8) before it is sent —
 *   typically 150–400 KB. Works on the phone and in the browser.
 *
 * persistScanImage — on the phone the camera writes to a cache folder the OS
 *   may clear, so the file is copied into the app's document directory (kept
 *   until the app is uninstalled). On the web there is no file system: the
 *   image is kept as a data URI when it is small enough for localStorage,
 *   otherwise dropped — the medicine still saves, just without its picture.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

import type { ScanImage } from '@/services/scanner/MedicationScannerService';

/** Long side after resizing. Enough for small print; small enough to send fast. */
export const SCAN_MAX_DIMENSION = 1600;
const SCAN_JPEG_QUALITY = 0.8;

/** localStorage is ~5 MB shared; keep one photo well under that. */
const MAX_WEB_IMAGE_BYTES = 900 * 1024;

export async function prepareScanImage(image: ScanImage): Promise<ScanImage> {
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  const longest = Math.max(width, height);
  const resize =
    longest > SCAN_MAX_DIMENSION
      ? width >= height
        ? { width: SCAN_MAX_DIMENSION }
        : { height: SCAN_MAX_DIMENSION }
      : null;

  try {
    const result = await ImageManipulator.manipulateAsync(image.uri, resize ? [{ resize }] : [], {
      compress: SCAN_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!result.base64) return image;
    return { uri: result.uri, base64: result.base64, mimeType: 'image/jpeg', width: result.width, height: result.height };
  } catch {
    // The manipulator is unavailable (some browsers): send the original.
    return image;
  }
}

export async function persistScanImage(image: ScanImage): Promise<string | null> {
  if (Platform.OS === 'web') {
    const bytes = Math.floor((image.base64.length * 3) / 4);
    return bytes <= MAX_WEB_IMAGE_BYTES ? `data:${image.mimeType};base64,${image.base64}` : null;
  }

  try {
    // Loaded lazily so the web bundle never touches the native module.
    const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    const directory = FileSystem.documentDirectory;
    if (!directory) return image.uri;
    const folder = `${directory}scans/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
    const extension = image.mimeType === 'image/png' ? 'png' : 'jpg';
    const target = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    await FileSystem.copyAsync({ from: image.uri, to: target });
    return target;
  } catch {
    // Better to keep the cache URI (may vanish) than to fail the save.
    return image.uri;
  }
}
