/**
 * Choose a label photo from the photo library (or, in the browser, from a
 * file picker). Returns null when the user cancels.
 *
 * `expo-image-picker` works on every platform, so this is the shared route
 * into a scan: the phone's camera screen offers it as an alternative, and the
 * web scan screen uses it as the only way in.
 */

import * as ImagePicker from 'expo-image-picker';

import type { ScanImage } from '@/services/scanner';

/** Keep uploads comfortably under the server's limit. */
const PICKER_QUALITY = 0.7;

/** The web picker sometimes hands back a full data URI; the reader wants bare base64. */
function stripDataPrefix(base64: string): string {
  const index = base64.indexOf('base64,');
  return index === -1 ? base64 : base64.slice(index + 'base64,'.length);
}

export async function pickLabelPhoto(): Promise<ScanImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: PICKER_QUALITY,
    allowsMultipleSelection: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.base64) return null;

  const mimeType: ScanImage['mimeType'] =
    asset.mimeType === 'image/png' || asset.uri.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  return {
    uri: asset.uri,
    base64: stripDataPrefix(asset.base64),
    mimeType,
    width: asset.width,
    height: asset.height,
  };
}
