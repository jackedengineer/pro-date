import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { OnboardingProgress } from './onboarding-progress';

interface OnboardingStepLayoutProps {
  children: ReactNode;
  current: number;
  footer: ReactNode;
  onBack?: (() => void) | undefined;
}

export function OnboardingStepLayout({
  children,
  current,
  footer,
  onBack,
}: OnboardingStepLayoutProps) {
  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {onBack === undefined ? null : (
            <Pressable
              accessibilityLabel="Go to previous profile step"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <AppText style={styles.backIcon} variant="title">
                ←
              </AppText>
            </Pressable>
          )}
          <View style={styles.progress}>
            <OnboardingProgress current={current} total={9} />
          </View>
        </View>

        <View style={styles.content}>{children}</View>
        <View style={styles.footer}>{footer}</View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backButtonPressed: {
    backgroundColor: colors.plumSoft,
  },
  backIcon: {
    fontFamily: typography.family.body,
    fontSize: 25,
    lineHeight: 29,
  },
  content: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  footer: {
    gap: spacing.md,
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  progress: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
