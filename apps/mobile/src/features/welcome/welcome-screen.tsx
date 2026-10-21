import { ScrollView, StyleSheet, View } from 'react-native';
import Heart from 'lucide-react-native/icons/heart';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing } from '../../theme/tokens';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Heart size={18} color={colors.plum} strokeWidth={2} />
          </View>
          <AppText style={styles.wordmark} variant="button">
            ProDate
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
            <AppText variant="eyebrow">Beyond the bio</AppText>
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
          <AppText variant="hero">Meet people, not profiles.</AppText>
          <AppText style={styles.subtitle}>Thoughtful prompts. Real conversation.</AppText>
          <AppText style={styles.subtitle}>
            For curious minds with a life beyond their tabs.
          </AppText>
        </View>
        <View style={styles.footer}>
          <AppButton label="Get started" onPress={onGetStarted} />
          <AppText style={styles.terms} variant="caption">
            By continuing, you confirm you are 18 or older.
          </AppText>
        </View>
      </ScrollView>
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
    minHeight: 240,
    marginTop: spacing.md,
    position: 'relative',
  },
  brandMark: {
    backgroundColor: colors.plumSoft,
    borderRadius: radii.sm,
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.md,
  },
  footer: {
    gap: spacing.md,
    marginTop: 'auto',
    paddingTop: spacing.xl,
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
    right: 0,
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
    boxShadow: '0px 6px 16px rgba(90, 46, 79, 0.05)',
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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
