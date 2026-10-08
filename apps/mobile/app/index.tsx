import { useAuth } from '@clerk/expo';
import { Redirect, router } from 'expo-router';

import { isClerkConfigured } from '../src/config/public-env';
import { WelcomeScreen } from '../src/features/welcome/welcome-screen';

export default function WelcomeRoute() {
  return isClerkConfigured ? <ConfiguredWelcomeRoute /> : <Welcome />;
}

function ConfiguredWelcomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/discover" />;
  }

  return <Welcome />;
}

function Welcome() {
  return <WelcomeScreen onGetStarted={() => router.push('/auth/phone')} />;
}
