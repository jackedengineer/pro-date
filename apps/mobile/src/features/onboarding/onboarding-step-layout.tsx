import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormScrollView } from '../../components/form-scroll-view';
import { IconButton } from '../../components/icon-button';

import { Screen } from '../../components/screen';
import { spacing } from '../../theme/tokens';
import { SignOutIconButton } from '../account/account-actions';
import { useOnboardingMode, useStepBack } from './onboarding-mode';
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
  const editing = useOnboardingMode() === 'edit';
  const back = useStepBack('Go to previous profile step');
  return (
    <Screen style={styles.screen}>
      <FormScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          {onBack === undefined ? null : (
            <IconButton label={back.label} icon={back.icon} onPress={onBack} />
          )}
          <View style={styles.progress}>
            <OnboardingProgress current={current} total={9} />
          </View>
          {editing ? null : <SignOutIconButton />}
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
