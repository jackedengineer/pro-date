import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing } from '../../theme/tokens';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brandMark} />
        <AppText style={styles.wordmark} variant="button">
          pro·dat
        </AppText>
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.art}
      >
        <View style={styles.orbitLarge} />
        <View style={styles.orbitSmall} />
        <View style={styles.promptCard}>
          <AppText variant="eyebrow">Profile prompt</AppText>
          <AppText style={styles.prompt} variant="title">
            A perfect Sunday looks like…
          </AppText>
          <View style={styles.answerPill}>
            <View style={styles.answerDot} />
            <AppText style={styles.answer} variant="caption">
              Long walks + excellent coffee
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <AppText variant="display">Meet people, not profiles.</AppText>
        <AppText style={styles.subtitle}>Thoughtful prompts. Real conversation.</AppText>
      </View>

      <View style={styles.footer}>
        <AppButton label="Get started" onPress={onGetStarted} />
        <AppText style={styles.terms} variant="caption">
          By continuing, you confirm you are 18 or older.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  answer: {
    color: colors.ink,
    flexShrink: 1,
  },
  answerDot: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  answerPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  art: {
    justifyContent: 'center',
    minHeight: 270,
    position: 'relative',
  },
  brandMark: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    height: 12,
    width: 12,
  },
  content: {
    gap: spacing.md,
  },
  footer: {
    gap: spacing.md,
    marginTop: 'auto',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  orbitLarge: {
    backgroundColor: colors.plumSoft,
    borderRadius: radii.pill,
    height: 116,
    position: 'absolute',
    right: -26,
    top: 8,
    width: 116,
  },
  orbitSmall: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    bottom: 20,
    height: 38,
    left: -10,
    position: 'absolute',
    width: 38,
  },
  prompt: {
    marginTop: spacing.sm,
    maxWidth: 260,
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: colors.plum,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
  },
  screen: {
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  subtitle: {
    color: colors.muted,
    maxWidth: 310,
  },
  terms: {
    textAlign: 'center',
  },
  wordmark: {
    color: colors.plum,
    letterSpacing: -0.4,
  },
});
