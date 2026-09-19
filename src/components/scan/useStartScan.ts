/**
 * The one way a photo becomes a scan: hand it to the scan store and open the
 * result screen, which shows the reading state until the reader finishes.
 *
 * Demo Mode picks the reader (mock vs. the Railway vision model) and, in the
 * mock, which of the three demonstration cases to play.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import type { DemoScenario } from '@/domain/scan';
import { useT } from '@/i18n';
import type { ScanImage } from '@/services/scanner';
import { useScanStore } from '@/stores/useScanStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useStartScan() {
  const router = useRouter();
  const { language } = useT();
  const demoMode = useSettingsStore((state) => state.demoMode);
  const run = useScanStore((state) => state.run);
  const [scenario, setScenario] = useState<DemoScenario>('SAFE');

  const start = useCallback(
    (image: ScanImage) => {
      void run(image, { demoMode, language, demoScenario: scenario });
      router.push('/scan/result');
    },
    [run, demoMode, language, scenario, router],
  );

  return { start, demoMode, scenario, setScenario };
}
