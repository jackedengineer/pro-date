import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing } from '../../theme/tokens';
import { OnboardingProgress } from './onboarding-progress';

interface ProfileCheckpointScreenProps {
  displayName?: string | undefined;
}

export function ProfileCheckpointScreen({ displayName }: ProfileCheckpointScreenProps) {
  return (
    <Screen style={styles.screen}>
      <OnboardingProgress current={3} total={8} />
      <View style={styles.content}>
        <View accessibilityElementsHidden style={styles.statusMark}>
          <AppText style={styles.statusIcon} variant="title">
            ✓
          </AppText>
        </View>
        <AppText variant="eyebrow">Checkpoint saved</AppText>
        <AppText variant="display">
          {displayName === undefined
            ? 'Profile draft restored'
            : `Core details saved, ${displayName}.`}
        </AppText>
        <AppText style={styles.supportingText}>
          Your progress is safely stored. We’ll continue from exactly here.
        </AppText>
        <View style={styles.nextStep}>
          <AppText style={styles.nextStepText} variant="button">
            Next: identity
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  nextStep: {
    alignSelf: 'flex-start',
    backgroundColor: colors.plumSoft,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  nextStepText: {
    color: colors.plum,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statusIcon: {
    color: colors.white,
  },
  statusMark: {
    alignItems: 'center',
    backgroundColor: colors.plum,
    borderRadius: radii.pill,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 56,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 340,
  },
});
