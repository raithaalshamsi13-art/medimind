/**
 * Choose label photos from the photo library (or, in the browser, from a
 * file picker). Returns an empty list when the user cancels.
 *
 * `expo-image-picker` works on every platform, so this is the shared route
 * into a scan: the phone's camera screen offers it as an alternative, and the
 * web scan screen uses it as the only way in. `pickLabelPhoto` (one) keeps
 * the original single-photo flow; `pickLabelPhotos` (several) feeds the
 * multi-photo tray.
 */

import * as ImagePicker from 'expo-image-picker';

import { MAX_SCAN_PHOTOS, type ScanImage } from '@/services/scanner';

/** Keep uploads comfortably under the server's limit. */
const PICKER_QUALITY = 0.85;

/** The web picker sometimes hands back a full data URI; the reader wants bare base64. */
function stripDataPrefix(base64: string): string {
  const index = base64.indexOf('base64,');
  return index === -1 ? base64 : base64.slice(index + 'base64,'.length);
}

function toScanImage(asset: ImagePicker.ImagePickerAsset): ScanImage | null {
  if (!asset.base64) return null;
  const mimeType: ScanImage['mimeType'] =
    asset.mimeType === 'image/png' || asset.uri.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  return { uri: asset.uri, base64: stripDataPrefix(asset.base64), mimeType, width: asset.width, height: asset.height };
}

/** Up to `limit` photos; images only, JPEG or PNG. */
export async function pickLabelPhotos(limit: number = MAX_SCAN_PHOTOS): Promise<ScanImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: PICKER_QUALITY,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
  });
  if (result.canceled) return [];
  return result.assets
    .slice(0, limit)
    .map(toScanImage)
    .filter((image): image is ScanImage => image !== null);
}

/** The single-photo path, unchanged in behaviour. */
export async function pickLabelPhoto(): Promise<ScanImage | null> {
  const [image] = await pickLabelPhotos(1);
  return image ?? null;
}
