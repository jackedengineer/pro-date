import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

import { isClerkConfigured } from '../../src/config/public-env';
import { AuthCompleteScreen } from '../../src/features/auth/auth-complete-screen';

export default function OnboardingRoute() {
  if (!isClerkConfigured) {
    return <Redirect href="/" />;
  }

  return <ConfiguredOnboardingRoute />;
}

function ConfiguredOnboardingRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/" />;
  }

  return <AuthCompleteScreen />;
}
