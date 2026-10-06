import type {
  HeightUpdate,
  IdentityUpdate,
  LocationUpdate,
  PreferencesUpdate,
  ProfilePhoto,
  ProfilePromptAnswer,
  ProfilePromptAnswerInput,
} from '@pro-date/contracts';
import { useState } from 'react';

import type { CurrentUser } from '../../api/current-user';
import type { ProfileCheckpoint } from '../../api/profile';
import type { CompletedProfilePhotos, LocalProfilePhoto } from '../../api/profile-photos';
import type { CompletedProfilePrompts } from '../../api/profile-prompts';
import { BirthdayScreen } from './birthday-screen';
import { DisplayNameScreen } from './display-name-screen';
import { HeightScreen } from './height-screen';
import { IdentityScreen } from './identity-screen';
import { LocationScreen } from './location-screen';
import { PreferencesScreen } from './preferences-screen';
import { ProfileCheckpointScreen } from './profile-checkpoint-screen';
import { ProfileOnboardingIntroScreen } from './profile-onboarding-intro-screen';
import { ProfilePhotosScreen } from './profile-photos-screen';
import { ProfilePromptsScreen } from './profile-prompts-screen';

export interface ProfileOnboardingFlowProps {
  captureLocation: () => Promise<LocationUpdate>;
  completePhotos: (photoIds: string[]) => Promise<CompletedProfilePhotos>;
  completePrompts: (prompts: ProfilePromptAnswerInput[]) => Promise<CompletedProfilePrompts>;
  initialUser: CurrentUser;
  loadPhotos: () => Promise<ProfilePhoto[]>;
  loadPrompts: () => Promise<ProfilePromptAnswer[]>;
  pickPhoto: () => Promise<LocalProfilePhoto | null>;
  removePhoto: (photoId: string) => Promise<ProfilePhoto[]>;
  saveBirthDate: (birthDate: string) => Promise<ProfileCheckpoint>;
  saveDisplayName: (displayName: string) => Promise<ProfileCheckpoint>;
  saveHeight: (height: HeightUpdate) => Promise<ProfileCheckpoint>;
  saveIdentity: (identity: IdentityUpdate) => Promise<ProfileCheckpoint>;
  saveLocation: (location: LocationUpdate) => Promise<ProfileCheckpoint>;
  savePreferences: (preferences: PreferencesUpdate) => Promise<ProfileCheckpoint>;
  uploadPhoto: (photo: LocalProfilePhoto, position: number) => Promise<ProfilePhoto[]>;
}

type VisibleStep =
  | 'birthday'
  | 'foundation'
  | 'height'
  | 'identity'
  | 'intro'
  | 'location'
  | 'name'
  | 'photos'
  | 'prompts'
  | 'preferences';

function getInitialVisibleStep(user: CurrentUser): VisibleStep {
  if (user.onboardingStatus === 'NOT_STARTED') {
    return 'intro';
  }

  if (user.onboardingStep === 'NAME') {
    return 'name';
  }

  const checkpointSteps: Record<CurrentUser['onboardingStep'], VisibleStep> = {
    BIRTHDAY: 'birthday',
    COMPLETE: 'foundation',
    DETAILS: 'height',
    IDENTITY: 'identity',
    LOCATION: 'location',
    NAME: 'name',
    PHOTOS: 'photos',
    PREFERENCES: 'preferences',
    PROMPTS: 'prompts',
    REVIEW: 'foundation',
  };

  return checkpointSteps[user.onboardingStep];
}

export function ProfileOnboardingFlow({
  captureLocation,
  completePhotos,
  completePrompts,
  initialUser,
  loadPhotos,
  loadPrompts,
  pickPhoto,
  removePhoto,
  saveBirthDate,
  saveDisplayName,
  saveHeight,
  saveIdentity,
  saveLocation,
  savePreferences,
  uploadPhoto,
}: ProfileOnboardingFlowProps) {
  const [profile, setProfile] = useState<ProfileCheckpoint>();
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
          setProfile(checkpoint);
          setVisibleStep('birthday');
        }}
      />
    );
  }

  if (visibleStep === 'birthday') {
    return (
      <BirthdayScreen
        onBack={profile?.displayName == null ? undefined : () => setVisibleStep('name')}
        onSave={async (birthDate) => {
          const checkpoint = await saveBirthDate(birthDate);
          setProfile(checkpoint);
          setVisibleStep('identity');
        }}
      />
    );
  }

  if (visibleStep === 'identity') {
    const initialValue =
      profile?.genderIdentity == null || profile.pronouns == null
        ? undefined
        : {
            arePronounsVisible: profile.arePronounsVisible,
            genderIdentity: profile.genderIdentity,
            isGenderVisible: profile.isGenderVisible,
            pronouns: profile.pronouns,
          };

    return (
      <IdentityScreen
        initialValue={initialValue}
        onBack={profile?.birthDate == null ? undefined : () => setVisibleStep('birthday')}
        onSave={async (identity) => {
          const checkpoint = await saveIdentity(identity);
          setProfile(checkpoint);
          setVisibleStep('preferences');
        }}
      />
    );
  }

  if (visibleStep === 'preferences') {
    const initialValue =
      profile?.relationshipIntent == null || profile.interestedIn.length === 0
        ? undefined
        : {
            interestedIn: profile.interestedIn,
            relationshipIntent: profile.relationshipIntent,
          };

    return (
      <PreferencesScreen
        initialValue={initialValue}
        onBack={profile?.genderIdentity == null ? undefined : () => setVisibleStep('identity')}
        onSave={async (preferences) => {
          const checkpoint = await savePreferences(preferences);
          setProfile(checkpoint);
          setVisibleStep('location');
        }}
      />
    );
  }

  if (visibleStep === 'location') {
    return (
      <LocationScreen
        captureLocation={captureLocation}
        onBack={
          profile?.relationshipIntent == null ? undefined : () => setVisibleStep('preferences')
        }
        onSave={async (location) => {
          const checkpoint = await saveLocation(location);
          setProfile(checkpoint);
          setVisibleStep('height');
        }}
      />
    );
  }

  if (visibleStep === 'height') {
    const initialValue =
      profile?.heightCm == null
        ? undefined
        : { centimeters: profile.heightCm, isVisible: profile.isHeightVisible };

    return (
      <HeightScreen
        initialValue={initialValue}
        onBack={profile?.hasLocation === true ? () => setVisibleStep('location') : undefined}
        onSave={async (height) => {
          const checkpoint = await saveHeight(height);
          setProfile(checkpoint);
          setVisibleStep('photos');
        }}
      />
    );
  }

  if (visibleStep === 'photos') {
    return (
      <ProfilePhotosScreen
        completePhotos={async (photoIds) => {
          await completePhotos(photoIds);
          setVisibleStep('prompts');
        }}
        loadPhotos={loadPhotos}
        onBack={profile?.heightCm == null ? undefined : () => setVisibleStep('height')}
        pickPhoto={pickPhoto}
        removePhoto={removePhoto}
        uploadPhoto={uploadPhoto}
      />
    );
  }

  if (visibleStep === 'prompts') {
    return (
      <ProfilePromptsScreen
        completePrompts={async (prompts) => {
          await completePrompts(prompts);
          setVisibleStep('foundation');
        }}
        loadPrompts={loadPrompts}
        onBack={() => setVisibleStep('photos')}
      />
    );
  }

  return <ProfileCheckpointScreen />;
}
