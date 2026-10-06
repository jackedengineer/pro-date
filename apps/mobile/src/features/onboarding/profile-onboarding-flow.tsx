import { useState } from 'react';

import type { CurrentUser } from '../../api/current-user';
import type { ProfileCheckpoint } from '../../api/profile';
import { BirthdayScreen } from './birthday-screen';
import { DisplayNameScreen } from './display-name-screen';
import { ProfileCheckpointScreen } from './profile-checkpoint-screen';
import { ProfileOnboardingIntroScreen } from './profile-onboarding-intro-screen';

interface ProfileOnboardingFlowProps {
  initialUser: CurrentUser;
  saveBirthDate: (birthDate: string) => Promise<ProfileCheckpoint>;
  saveDisplayName: (displayName: string) => Promise<ProfileCheckpoint>;
}

type VisibleStep = 'birthday' | 'checkpoint' | 'intro' | 'name';

function getInitialVisibleStep(user: CurrentUser): VisibleStep {
  if (user.onboardingStatus === 'NOT_STARTED') {
    return 'intro';
  }

  if (user.onboardingStep === 'NAME') {
    return 'name';
  }

  return user.onboardingStep === 'BIRTHDAY' ? 'birthday' : 'checkpoint';
}

export function ProfileOnboardingFlow({
  initialUser,
  saveBirthDate,
  saveDisplayName,
}: ProfileOnboardingFlowProps) {
  const [displayName, setDisplayName] = useState<string>();
  const [visibleStep, setVisibleStep] = useState<VisibleStep>(() =>
    getInitialVisibleStep(initialUser),
  );

  if (visibleStep === 'intro') {
    return <ProfileOnboardingIntroScreen onContinue={() => setVisibleStep('name')} />;
  }

  if (visibleStep === 'name') {
    return (
      <DisplayNameScreen
        onBack={() => setVisibleStep('intro')}
        onSave={async (name) => {
          const checkpoint = await saveDisplayName(name);
          setDisplayName(checkpoint.displayName ?? name);
          setVisibleStep('birthday');
        }}
      />
    );
  }

  if (visibleStep === 'birthday') {
    return (
      <BirthdayScreen
        onBack={displayName === undefined ? undefined : () => setVisibleStep('name')}
        onSave={async (birthDate) => {
          const checkpoint = await saveBirthDate(birthDate);
          setDisplayName((currentName) => checkpoint.displayName ?? currentName);
          setVisibleStep('checkpoint');
        }}
      />
    );
  }

  return <ProfileCheckpointScreen displayName={displayName} />;
}
