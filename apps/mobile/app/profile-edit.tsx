import { useAuth } from '@clerk/expo';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { useProfileActions } from '../src/auth/use-profile-actions';
import { apiBaseUrl, isClerkConfigured } from '../src/config/public-env';
import { EDITABLE_STEPS } from '../src/features/onboarding/profile-onboarding-flow';
import { ProfileEditFlow } from '../src/features/profile/profile-edit-flow';

/** One part of a finished profile, opened as a sheet from the Profile tab. */
export default function ProfileEditRoute() {
  return isClerkConfigured && apiBaseUrl !== null ? (
    <ConfiguredProfileEditRoute />
  ) : (
    <Redirect href="/" />
  );
}

function ConfiguredProfileEditRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const actions = useProfileActions();
  const { field } = useLocalSearchParams<{ field?: string }>();
  const step = EDITABLE_STEPS.find((value) => value === field);

  if (isLoaded && !isSignedIn) return <Redirect href="/" />;
  if (step === undefined) return <Redirect href="/discover?tab=profile" />;

  return <ProfileEditFlow {...actions} step={step} onDone={() => router.back()} />;
}
