import { ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing } from '../../theme/tokens';

interface ProfileOnboardingIntroScreenProps {
  onContinue: () => void;
}

const workflow = [
  {
    badge: 'PR',
    description: 'Send a thoughtful like or reply.',
    title: 'Open a PR',
  },
  {
    badge: '↗',
    description: 'See who wants to connect.',
    title: 'Review PR',
  },
  {
    badge: '✓',
    description: 'You matched—start a thread.',
    title: 'Merged',
  },
] as const;

export function ProfileOnboardingIntroScreen({ onContinue }: ProfileOnboardingIntroScreenProps) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topline}>
          <AppText variant="eyebrow">Profile setup</AppText>
          <View style={styles.autosaveBadge}>
            <View style={styles.autosaveDot} />
            <AppText style={styles.autosaveText} variant="caption">
              Autosaves
            </AppText>
          </View>
        </View>

        <View style={styles.hero}>
          <AppText variant="display">Build a profile worth replying to.</AppText>
          <AppText style={styles.supportingText}>
            Clear beats clever. We’ll help you show enough personality to make the first message
            easy.
          </AppText>
        </View>

        <View style={styles.workflow}>
          <AppText style={styles.workflowLabel} variant="eyebrow">
            How ProDate works
          </AppText>
          {workflow.map((item) => (
            <View key={item.title} style={styles.workflowRow}>
              <View accessibilityElementsHidden style={styles.workflowBadge}>
                <AppText style={styles.workflowBadgeText} variant="caption">
                  {item.badge}
                </AppText>
              </View>
              <View style={styles.workflowCopy}>
                <AppText variant="button">{item.title}</AppText>
                <AppText variant="caption">{item.description}</AppText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <AppButton label="Start building" onPress={onContinue} />
          <AppText style={styles.footerNote} variant="caption">
            About 4 minutes · Edit anything before publishing
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  autosaveBadge: {
    alignItems: 'center',
    backgroundColor: colors.plumSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  autosaveDot: {
    backgroundColor: colors.plum,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  autosaveText: {
    color: colors.plum,
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  footerNote: {
    textAlign: 'center',
  },
  hero: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 350,
  },
  topline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  workflow: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  workflowBadge: {
    alignItems: 'center',
    backgroundColor: colors.sand,
    borderRadius: radii.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  workflowBadgeText: {
    color: colors.plum,
    fontFamily: 'Manrope_600SemiBold',
  },
  workflowCopy: {
    flex: 1,
    gap: 2,
  },
  workflowLabel: {
    marginBottom: spacing.xs,
  },
  workflowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
