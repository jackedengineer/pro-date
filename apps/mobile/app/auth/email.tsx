import { useAuth, useSignIn } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { isClerkConfigured } from '../../src/config/public-env';
import { getSafeAuthErrorMessage, requestEmailCode } from '../../src/features/auth/clerk-otp';
import { EmailEntryScreen } from '../../src/features/auth/email-entry-screen';

export default function EmailRoute() {
  return isClerkConfigured ? <ConfiguredEmailRoute /> : <UnconfiguredEmailRoute />;
}

function UnconfiguredEmailRoute() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <EmailEntryScreen
      errorMessage={errorMessage}
      onBack={() => router.back()}
      onContinue={() => {
        setErrorMessage(
          'Email verification is not configured on this build. Add the Clerk publishable key and restart Expo.',
        );
      }}
      onUsePhone={() => router.replace('/auth/phone')}
    />
  );
}

function ConfiguredEmailRoute() {
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

  const sendCode = async (emailAddress: string) => {
    if (signIn === null || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await requestEmailCode(signIn, emailAddress);

    if (result.ok) {
      router.push('/auth/verify-email');
    } else if ('error' in result) {
      setErrorMessage(getSafeAuthErrorMessage(result.error, 'request', 'email'));
    } else {
      setErrorMessage('Email verification could not start. Try again.');
    }

    setIsSubmitting(false);
  };

  const usePhone = () => {
    if (signIn !== null) {
      void signIn.reset();
    }
    router.replace('/auth/phone');
  };

  return (
    <EmailEntryScreen
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onBack={() => router.back()}
      onContinue={(emailAddress) => void sendCode(emailAddress)}
      onUsePhone={usePhone}
    />
  );
}
