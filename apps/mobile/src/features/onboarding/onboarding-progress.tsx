import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '../../components/app-text';
import { useReducedMotionPreference } from '../../theme/motion';
import { colors, duration, radii, spacing } from '../../theme/tokens';

interface OnboardingProgressProps {
  current: number;
  total: number;
}

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  const progress = Math.min(Math.max(current / total, 0), 1);
  const reduced = useReducedMotionPreference();

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={`Profile setup, step ${current} of ${total}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: total, min: 0, now: current }}
        style={styles.track}
      >
        {/* Out of flow and childless, so animating width re-lays-out nothing else. */}
        <Animated.View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
              transitionProperty: 'width',
              transitionDuration: reduced ? 0 : duration.standard,
              transitionTimingFunction: 'ease-out',
            },
          ]}
        />
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
    backgroundColor: colors.plum,
    borderRadius: radii.pill,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  label: {
    fontVariant: ['tabular-nums'],
  },
  track: {
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
});
