import { useSignIn, useSignUp } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { isClerkConfigured } from '../../src/config/public-env';
import { isValidEmailAddress, maskEmailAddress } from '../../src/features/auth/auth-identifiers';
import {
  getSafeAuthErrorMessage,
  resendEmailCode,
  verifyEmailCode,
} from '../../src/features/auth/clerk-otp';
import { OtpVerificationScreen } from '../../src/features/auth/otp-verification-screen';
import { useResendCountdown } from '../../src/features/auth/use-resend-countdown';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmailRoute() {
  return isClerkConfigured ? <ConfiguredVerifyEmailRoute /> : <Redirect href="/auth/email" />;
}

function ConfiguredVerifyEmailRoute() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { restart, secondsRemaining } = useResendCountdown(RESEND_COOLDOWN_SECONDS);
  const [activity, setActivity] = useState<'idle' | 'resending' | 'verifying'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const emailAddress = signIn?.identifier;

  if (!isValidEmailAddress(emailAddress)) {
    return <Redirect href="/auth/email" />;
  }

  const changeEmailAddress = () => {
    if (signIn !== null) {
      void signIn.reset();
    }
    router.replace('/auth/email');
  };

  const submitCode = async (code: string) => {
    if (signIn === null || signUp === null || activity !== 'idle') {
      return;
    }

    setActivity('verifying');
    setErrorMessage(null);
    const result = await verifyEmailCode(signIn, signUp, code);

    if (result.ok) {
      router.replace('/onboarding');
      return;
    }

    if ('error' in result) {
      setErrorMessage(getSafeAuthErrorMessage(result.error, 'verify', 'email'));
    } else if (result.kind === 'missing_requirements') {
      setErrorMessage(
        'Account setup needs another Clerk field. Check the dashboard sign-up requirements.',
      );
    } else {
      setErrorMessage('This account needs an authentication step ProDate does not support yet.');
    }

    setActivity('idle');
  };

  const resendCode = async () => {
    if (signIn === null || secondsRemaining !== 0 || activity !== 'idle') {
      return;
    }

    setActivity('resending');
    setErrorMessage(null);
    const result = await resendEmailCode(signIn);

    if (result.ok) {
      restart();
    } else if ('error' in result) {
      setErrorMessage(getSafeAuthErrorMessage(result.error, 'request', 'email'));
    } else {
      setErrorMessage('We couldn’t send another code. Change your email and try again.');
    }

    setActivity('idle');
  };

  return (
    <OtpVerificationScreen
      changeDestinationAccessibilityLabel="Change email address"
      destination={maskEmailAddress(emailAddress)}
      errorMessage={errorMessage}
      isResending={activity === 'resending'}
      isSubmitting={activity === 'verifying'}
      onBack={changeEmailAddress}
      onResend={() => void resendCode()}
      onSubmit={(code) => void submitCode(code)}
      resendSecondsRemaining={secondsRemaining}
    />
  );
}
