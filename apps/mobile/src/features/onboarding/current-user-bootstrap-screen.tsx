import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { CurrentUser } from '../../api/current-user';
import type { ProfileCheckpoint } from '../../api/profile';
import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, spacing } from '../../theme/tokens';
import { ProfileOnboardingFlow } from './profile-onboarding-flow';

interface CurrentUserBootstrapScreenProps {
  bootstrap: () => Promise<CurrentUser>;
  saveBirthDate: (birthDate: string) => Promise<ProfileCheckpoint>;
  saveDisplayName: (displayName: string) => Promise<ProfileCheckpoint>;
}

type BootstrapState =
  | { status: 'loading' }
  | { currentUser: CurrentUser; status: 'ready' }
  | { message: string; status: 'error' };

export function CurrentUserBootstrapScreen({
  bootstrap,
  saveBirthDate,
  saveDisplayName,
}: CurrentUserBootstrapScreenProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;

    void bootstrap()
      .then((currentUser) => {
        if (isActive) {
          setState({ currentUser, status: 'ready' });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            message:
              error instanceof Error
                ? error.message
                : 'We could not prepare your profile. Please try again.',
            status: 'error',
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [attempt, bootstrap]);

  if (state.status === 'ready') {
    return (
      <ProfileOnboardingFlow
        initialUser={state.currentUser}
        saveBirthDate={saveBirthDate}
        saveDisplayName={saveDisplayName}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <Screen style={styles.screen}>
        <View style={styles.content}>
          <AppText variant="eyebrow">Connection interrupted</AppText>
          <AppText variant="display">Let’s try that again</AppText>
          <AppText style={styles.supportingText}>{state.message}</AppText>
          <AppButton
            label="Retry"
            onPress={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View accessibilityRole="progressbar" style={styles.content}>
        <ActivityIndicator color={colors.plum} size="large" />
        <AppText variant="title">Preparing your profile</AppText>
        <AppText style={styles.supportingText}>
          We’re securely connecting your account to ProDate.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 340,
  },
});
