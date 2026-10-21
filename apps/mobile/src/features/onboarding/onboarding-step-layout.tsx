import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { FormScrollView } from '../../components/form-scroll-view';
import { IconButton } from '../../components/icon-button';

import { Screen } from '../../components/screen';
import { spacing } from '../../theme/tokens';
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
      <FormScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          {onBack === undefined ? null : (
            <IconButton label="Go to previous profile step" icon={ArrowLeft} onPress={onBack} />
          )}
          <View style={styles.progress}>
            <OnboardingProgress current={current} total={9} />
          </View>
        </View>

        <View style={styles.content}>{children}</View>
        <View style={styles.footer}>{footer}</View>
      </FormScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  footer: {
    gap: spacing.md,
    marginTop: 'auto',
    paddingTop: spacing.lg,
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
    paddingBottom: spacing.xl,
  },
});
