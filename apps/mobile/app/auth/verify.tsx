import { useSignIn, useSignUp } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { isClerkConfigured } from '../../src/config/public-env';
import {
  getSafeAuthErrorMessage,
  isIndianE164PhoneNumber,
  resendPhoneCode,
  verifyPhoneCode,
} from '../../src/features/auth/clerk-phone-otp';
import { OtpVerificationScreen } from '../../src/features/auth/otp-verification-screen';
import { useResendCountdown } from '../../src/features/auth/use-resend-countdown';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyPhoneRoute() {
  return isClerkConfigured ? <ConfiguredVerifyPhoneRoute /> : <Redirect href="/auth/phone" />;
}

function ConfiguredVerifyPhoneRoute() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { restart, secondsRemaining } = useResendCountdown(RESEND_COOLDOWN_SECONDS);
  const [activity, setActivity] = useState<'idle' | 'resending' | 'verifying'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const phoneNumber = signIn?.identifier;

  if (!isIndianE164PhoneNumber(phoneNumber)) {
    return <Redirect href="/auth/phone" />;
  }

  const changePhoneNumber = () => {
    if (signIn !== null) {
      void signIn.reset();
    }
    router.replace('/auth/phone');
  };

  const submitCode = async (code: string) => {
    if (signIn === null || signUp === null || activity !== 'idle') {
      return;
    }

    setActivity('verifying');
    setErrorMessage(null);
    const result = await verifyPhoneCode(signIn, signUp, code);

    if (result.ok) {
      router.replace('/onboarding');
      return;
    }

    if ('error' in result) {
      setErrorMessage(getSafeAuthErrorMessage(result.error, 'verify'));
    } else if (result.kind === 'missing_requirements') {
      setErrorMessage(
        'Account setup needs an unsupported Clerk field. Check the dashboard phone-only settings.',
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
    const result = await resendPhoneCode(signIn);

    if (result.ok) {
      restart();
    } else if ('error' in result) {
      setErrorMessage(getSafeAuthErrorMessage(result.error, 'request'));
    } else {
      setErrorMessage('We couldn’t send another code. Change your number and try again.');
    }

    setActivity('idle');
  };

  return (
    <OtpVerificationScreen
      errorMessage={errorMessage}
      isResending={activity === 'resending'}
      isSubmitting={activity === 'verifying'}
      onBack={changePhoneNumber}
      onResend={() => void resendCode()}
      onSubmit={(code) => void submitCode(code)}
      phoneNumber={phoneNumber}
      resendSecondsRemaining={secondsRemaining}
    />
  );
}
