/**
 * Keep the scanned photo with the medicine.
 *
 * On the phone the camera writes to a cache folder the OS may clear, so the
 * file is copied into the app's document directory (kept until the app is
 * uninstalled). On the web there is no file system: the image is kept as a
 * data URI when it is small enough for localStorage, otherwise dropped — the
 * medicine still saves, just without its picture.
 */

import { Platform } from 'react-native';

import type { ScanImage } from '@/services/scanner/MedicationScannerService';

/** localStorage is ~5 MB shared; keep one photo well under that. */
const MAX_WEB_IMAGE_BYTES = 900 * 1024;

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
