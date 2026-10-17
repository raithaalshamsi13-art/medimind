/**
 * The photos collected for ONE medicine before they are scanned together:
 * small previews, a remove button on each, "Add another", and one clear
 * "Scan all photos" button. Used by the camera screen (phone) and the
 * photo-picker screen (web); the single-photo flow never shows it.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useT } from '@/i18n';
import type { ScanImage } from '@/services/scanner';
import { useTheme } from '@/theme/ThemeContext';

const THUMB = 64;

export function PhotoTray({
  photos,
  max,
  onRemove,
  onAdd,
  onScanAll,
  compact = false,
}: {
  photos: ScanImage[];
  max: number;
  onRemove: (index: number) => void;
  /** Add from the library (the camera screen also has its shutter). */
  onAdd?: () => void;
  onScanAll: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const { t } = useT();
  const full = photos.length >= max;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" color={compact ? 'textSecondary' : 'textMuted'}>
        {t('scan.multi.tray', { count: photos.length, max }).toUpperCase()}
      </AppText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
        {photos.map((photo, index) => (
          <View key={`${index}-${photo.uri.slice(-24)}`} style={{ width: THUMB, height: THUMB }}>
            <Image
              source={{ uri: photo.uri }}
              accessibilityLabel={t('scan.multi.photoN', { n: index + 1 })}
              style={{
                width: THUMB,
                height: THUMB,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            />
            <Pressable
              onPress={() => onRemove(index)}
              accessibilityRole="button"
              accessibilityLabel={t('scan.multi.remove', { n: index + 1 })}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: theme.colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </Pressable>
            <View
              style={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                paddingHorizontal: 5,
                borderRadius: theme.radius.sm,
                backgroundColor: 'rgba(0,0,0,0.55)',
              }}>
              <AppText variant="caption" style={{ color: '#FFFFFF' }}>
                {index + 1}
              </AppText>
            </View>
          </View>
        ))}

        {onAdd && !full ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={t('scan.multi.addFromLibrary')}
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="add" size={26} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </ScrollView>

      {full ? (
        <AppText variant="caption" color="textMuted">
          {t('scan.multi.max', { max })}
        </AppText>
      ) : null}

      <Button
        label={t('scan.multi.scanAll', { count: photos.length })}
        icon="scan-outline"
        size={compact ? 'medium' : 'large'}
        onPress={onScanAll}
        disabled={photos.length === 0}
      />
    </View>
  );
}
