import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing } from '../../theme/tokens';
import { OnboardingProgress } from './onboarding-progress';

export function ProfileCheckpointScreen() {
  return (
    <Screen style={styles.screen}>
      <OnboardingProgress current={9} total={9} />
      <View style={styles.content}>
        <View accessibilityElementsHidden style={styles.statusMark}>
          <AppText style={styles.statusIcon} variant="title">
            ✓
          </AppText>
        </View>
        <AppText variant="eyebrow">Prompts committed</AppText>
        <AppText variant="display">The profile has a point of view.</AppText>
        <AppText style={styles.supportingText}>
          Your basics, photos, and conversation hooks are synced. One complete card review is next.
        </AppText>
        <View style={styles.nextStep}>
          <AppText style={styles.nextStepText} variant="button">
            Next: profile review
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
