import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { useCallback } from 'react';

import { bootstrapCurrentUser } from '../../src/api/current-user';
import { saveProfileBirthDate, saveProfileDisplayName } from '../../src/api/profile';
import { apiBaseUrl, isClerkConfigured } from '../../src/config/public-env';
import { AuthCompleteScreen } from '../../src/features/auth/auth-complete-screen';
import { CurrentUserBootstrapScreen } from '../../src/features/onboarding/current-user-bootstrap-screen';

export default function OnboardingRoute() {
  if (!isClerkConfigured) {
    return <Redirect href="/" />;
  }

  return <ConfiguredOnboardingRoute />;
}

function ConfiguredOnboardingRoute() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const bootstrap = useCallback(() => {
    if (apiBaseUrl === null) {
      return Promise.reject(new Error('The ProDate API is not configured.'));
    }

    return bootstrapCurrentUser({ apiBaseUrl, getToken });
  }, [getToken]);
  const saveDisplayName = useCallback(
    (displayName: string) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfileDisplayName({ apiBaseUrl, displayName, getToken });
    },
    [getToken],
  );
  const saveBirthDate = useCallback(
    (birthDate: string) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfileBirthDate({ apiBaseUrl, birthDate, getToken });
    },
    [getToken],
  );

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/" />;
  }

  return apiBaseUrl === null ? (
    <AuthCompleteScreen />
  ) : (
    <CurrentUserBootstrapScreen
      bootstrap={bootstrap}
      saveBirthDate={saveBirthDate}
      saveDisplayName={saveDisplayName}
    />
  );
}
