import { type ImageRequireSource, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Heart from 'lucide-react-native/icons/heart';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Reveal } from '../../components/reveal';
import { Screen } from '../../components/screen';
import { cardShadow, colors, hairline, radii, spacing } from '../../theme/tokens';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <Reveal style={styles.header}>
          <View style={styles.brandMark}>
            <Image
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              contentFit="contain"
              source={require('../../../assets/brand/merge-mark.png') as ImageRequireSource}
              style={styles.brandImage}
            />
          </View>
          <AppText style={styles.wordmark} variant="title" accessibilityRole="text">
            Merge
          </AppText>
        </Reveal>

        {/* The whole product in one picture: a line someone wrote, and a like on it. */}
        <Reveal order={1} style={styles.art}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.artInner}
          >
            <View style={[styles.promptCard, styles.promptCardBehind]} />
            <View style={styles.promptCard}>
              <AppText variant="caption" style={styles.question}>
                A perfect Sunday looks like…
              </AppText>
              <AppText variant="quote" style={styles.prompt}>
                Long walks, then excellent coffee.
              </AppText>
              <View style={styles.like}>
                <Heart size={22} color={colors.coral} strokeWidth={2} />
              </View>
            </View>
          </View>
        </Reveal>

        <Reveal order={2} style={styles.content}>
          <AppText variant="hero">Meet people, not profiles.</AppText>
          <AppText style={styles.subtitle}>Thoughtful prompts. Real conversation.</AppText>
          <AppText style={styles.subtitle}>
            Like a line someone wrote and send a pull request. If they like you back, you’re merged.
          </AppText>
        </Reveal>

        <Reveal order={3} style={styles.footer}>
          <AppButton label="Get started" onPress={onGetStarted} />
          <AppText style={styles.terms} variant="caption">
            By continuing, you confirm you are 18 or older.
          </AppText>
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: {
    marginTop: spacing.md,
  },
  artInner: {
    justifyContent: 'center',
    minHeight: 220,
    paddingRight: spacing.md,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.plumSoft,
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brandImage: { width: 36, height: 36 },
  content: {
    gap: spacing.sm,
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
  like: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: hairline,
    bottom: -spacing.md,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    width: 48,
    ...cardShadow,
  },
  prompt: {
    marginTop: spacing.xs,
    maxWidth: 260,
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: hairline,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...cardShadow,
  },
  // A second card tucked behind, so the prompt reads as one of several.
  promptCardBehind: {
    backgroundColor: colors.sand,
    bottom: 0,
    left: spacing.md,
    position: 'absolute',
    right: 0,
    top: spacing.lg,
    transform: [{ rotate: '3deg' }],
  },
  question: {
    maxWidth: 240,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  subtitle: {
    color: colors.muted,
    maxWidth: 330,
  },
  terms: {
    textAlign: 'center',
  },
  wordmark: {
    color: colors.plum,
  },
});
