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
    description: 'Like a photo or reply with intent.',
    title: 'Open a PR',
  },
  {
    badge: '↗',
    description: 'See who wants to connect.',
    title: 'Review PR',
  },
  {
    badge: '✓',
    description: 'Mutual interest. Thread unlocked.',
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
              9 small steps
            </AppText>
          </View>
        </View>

        <View style={styles.hero}>
          <AppText variant="display">Build a profile worth replying to.</AppText>
          <AppText style={styles.supportingText}>
            A few details, your favourite photos, and three conversation starters. We’ll take it one
            step at a time.
          </AppText>
        </View>

        <View style={styles.workflow}>
          <AppText style={styles.workflowLabel} variant="eyebrow">
            How connections happen
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
            Review everything before your profile goes live.
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
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  workflow: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
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
