import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';

interface OnboardingProgressProps {
  current: number;
  total: number;
}

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  const progress = Math.min(Math.max(current / total, 0), 1);

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={`Profile setup, step ${current} of ${total}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: total, min: 0, now: current }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <AppText style={styles.label} variant="caption">
        {current} / {total}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  fill: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    height: '100%',
  },
  label: {
    fontVariant: ['tabular-nums'],
  },
  track: {
    backgroundColor: colors.plumSoft,
    borderRadius: radii.pill,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
});
