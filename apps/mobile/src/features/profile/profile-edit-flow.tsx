import type { ProfileReview } from '@pro-date/contracts';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, spacing } from '../../theme/tokens';
import { ErrorNotice } from '../discovery/discovery-shared';
import { OnboardingModeContext } from '../onboarding/onboarding-mode';
import {
  ProfileOnboardingFlow,
  type EditableStep,
  type ProfileOnboardingFlowProps,
} from '../onboarding/profile-onboarding-flow';

interface ProfileEditFlowProps extends Omit<ProfileOnboardingFlowProps, 'initialUser' | 'edit'> {
  step: EditableStep;
  onDone: () => void;
}

/**
 * Opens one setup step on its own, filled in with what the member already saved. It saves
 * through the same calls as setup; a live profile stays live, so there is nothing to publish.
 */
export function ProfileEditFlow({ step, onDone, ...actions }: ProfileEditFlowProps) {
  const { loadProfileReview } = actions;
  const [review, setReview] = useState<ProfileReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadProfileReview()
      .then((loaded) => {
        if (active) setReview(loaded);
      })
      .catch((failure: unknown) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'Couldn’t load your profile.');
      });
    return () => {
      active = false;
    };
  }, [loadProfileReview]);

  if (review === null)
    return (
      <Screen style={styles.pending}>
        {error === null ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Loading your profile">
            <ActivityIndicator color={colors.plum} />
          </View>
        ) : (
          <>
            <ErrorNotice message={error} />
            <AppText style={styles.muted}>Nothing was changed.</AppText>
            <AppButton label="Close" variant="secondary" onPress={onDone} />
          </>
        )}
      </Screen>
    );

  return (
    <OnboardingModeContext.Provider value="edit">
      <ProfileOnboardingFlow {...actions} edit={{ step, profile: review.profile, onDone }} />
    </OnboardingModeContext.Provider>
  );
}

const styles = StyleSheet.create({
  pending: { justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  muted: { color: colors.muted },
});
