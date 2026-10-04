import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing } from '../../theme/tokens';

export function AuthCompleteScreen() {
  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <View accessibilityElementsHidden style={styles.successMark}>
          <AppText style={styles.checkmark} variant="title">
            ✓
          </AppText>
        </View>
        <AppText variant="eyebrow">Account secured</AppText>
        <AppText variant="display">Account verified</AppText>
        <AppText style={styles.supportingText}>
          Your account is secure. Next, we’ll help you build a profile that feels like you.
        </AppText>
        <View style={styles.nextStep}>
          <AppText style={styles.nextStepText} variant="button">
            Next: profile setup
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  checkmark: {
    color: colors.white,
  },
  content: {
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  successMark: {
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
