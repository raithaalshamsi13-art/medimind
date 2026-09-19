/**
 * Demo Mode chips: which fixed reading the mock scanner returns for the next
 * photo. Only rendered while Demo Mode is on, and says so — the user must
 * never mistake a demonstration result for a real reading.
 */

import { View } from 'react-native';

import { AppText, ChoiceChips, type ChipOption } from '@/components/ui';
import { DEMO_SCENARIOS, type DemoScenario } from '@/domain/scan';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

export function DemoScenarioPicker({
  value,
  onChange,
  compact = false,
}: {
  value: DemoScenario;
  onChange: (scenario: DemoScenario) => void;
  /** Tighter copy for the strip over the camera. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const { t } = useT();

  const options: readonly ChipOption<DemoScenario>[] = DEMO_SCENARIOS.map((scenario) => ({
    value: scenario,
    label: t(`scan.demo.${scenario}`),
  }));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" color={compact ? 'textSecondary' : 'textMuted'}>
        {t('scan.demoTitle').toUpperCase()}
      </AppText>
      {compact ? null : (
        <AppText variant="caption" color="textSecondary">
          {t('scan.demoBody')}
        </AppText>
      )}
      <ChoiceChips
        options={options}
        value={value}
        onChange={(next) => next && onChange(next)}
        accessibilityLabel={t('scan.demoTitle')}
        allowClear={false}
      />
    </View>
  );
}
