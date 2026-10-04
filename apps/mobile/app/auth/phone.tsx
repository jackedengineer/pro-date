import { useAuth, useSignIn } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { isClerkConfigured } from '../../src/config/public-env';
import { getSafeAuthErrorMessage, requestPhoneCode } from '../../src/features/auth/clerk-phone-otp';
import { PhoneEntryScreen } from '../../src/features/auth/phone-entry-screen';

export default function PhoneRoute() {
  return isClerkConfigured ? <ConfiguredPhoneRoute /> : <UnconfiguredPhoneRoute />;
}

function UnconfiguredPhoneRoute() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <PhoneEntryScreen
      errorMessage={errorMessage}
      onBack={() => router.back()}
      onContinue={() => {
        setErrorMessage(
          'Phone verification is not configured on this build. Add the Clerk publishable key and restart Expo.',
        );
      }}
    />
  );
}

function ConfiguredPhoneRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/onboarding" />;
  }

  const sendCode = async (phoneNumber: string) => {
    if (signIn === null || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await requestPhoneCode(signIn, phoneNumber);

    if (result.ok) {
      router.push('/auth/verify');
    } else if ('error' in result) {
      setErrorMessage(getSafeAuthErrorMessage(result.error, 'request'));
    } else {
      setErrorMessage('Phone verification could not start. Try again.');
    }

    setIsSubmitting(false);
  };

  return (
    <PhoneEntryScreen
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onBack={() => router.back()}
      onContinue={(phoneNumber) => void sendCode(phoneNumber)}
    />
  );
}
