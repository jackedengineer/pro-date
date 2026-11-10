import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '../../components/app-text';
import { useReducedMotionPreference } from '../../theme/motion';
import { colors, duration, radii, spacing } from '../../theme/tokens';
import { useOnboardingMode } from './onboarding-mode';

interface OnboardingProgressProps {
  current: number;
  total: number;
}

/** Nine steps read as a long form; three short chapters read as nearly done. */
export const ONBOARDING_CHAPTERS = ['About you', 'The details', 'Show yourself'] as const;

export function onboardingChapter(current: number, total: number) {
  const perChapter = Math.ceil(total / ONBOARDING_CHAPTERS.length);
  const step = Math.min(Math.max(current, 1), total);
  const index = Math.min(ONBOARDING_CHAPTERS.length - 1, Math.floor((step - 1) / perChapter));
  return {
    index,
    name: ONBOARDING_CHAPTERS[index]!,
    progress: (step - index * perChapter) / perChapter,
  };
}

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  const reduced = useReducedMotionPreference();
  const editing = useOnboardingMode() === 'edit';
  // Editing one thing from a finished profile is not a step in a sequence.
  if (editing) return null;
  const chapter = onboardingChapter(current, total);

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={`Profile setup, step ${current} of ${total}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: total, min: 0, now: current }}
        style={styles.segments}
      >
        {ONBOARDING_CHAPTERS.map((name, index) => (
          <View key={name} style={styles.track}>
            {/* Out of flow and childless, so animating width re-lays-out nothing else. */}
            <Animated.View
              style={[
                styles.fill,
                {
                  width: `${(index < chapter.index ? 1 : index === chapter.index ? chapter.progress : 0) * 100}%`,
                  transitionProperty: 'width',
                  transitionDuration: reduced ? 0 : duration.standard,
                  transitionTimingFunction: 'ease-out',
                },
              ]}
            />
          </View>
        ))}
      </View>
      <AppText numberOfLines={1} style={styles.label} variant="caption">
        {chapter.name}
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
    flexShrink: 0,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  track: {
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
});
