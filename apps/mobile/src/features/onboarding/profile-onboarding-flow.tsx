import { useState } from 'react';

import type { CurrentUser } from '../../api/current-user';
import type { ProfileCheckpoint } from '../../api/profile';
import { DisplayNameScreen } from './display-name-screen';
import { ProfileCheckpointScreen } from './profile-checkpoint-screen';
import { ProfileOnboardingIntroScreen } from './profile-onboarding-intro-screen';

interface ProfileOnboardingFlowProps {
  initialUser: CurrentUser;
  saveDisplayName: (displayName: string) => Promise<ProfileCheckpoint>;
}

type VisibleStep = 'intro' | 'name' | 'checkpoint';

function getInitialVisibleStep(user: CurrentUser): VisibleStep {
  if (user.onboardingStatus === 'NOT_STARTED') {
    return 'intro';
  }

  return user.onboardingStep === 'NAME' ? 'name' : 'checkpoint';
}

export function ProfileOnboardingFlow({
  initialUser,
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
          setVisibleStep('checkpoint');
        }}
      />
    );
  }

  return <ProfileCheckpointScreen displayName={displayName} />;
}
