import type {
  HeightUpdate,
  IdentityUpdate,
  LocationUpdate,
  PreferencesUpdate,
  ProfilePhoto,
  ProfilePromptAnswer,
  ProfilePromptAnswerInput,
  ProfileReview,
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
import { ProfileOnboardingIntroScreen } from './profile-onboarding-intro-screen';
import { ProfilePhotosScreen } from './profile-photos-screen';
import { ProfilePromptsScreen } from './profile-prompts-screen';
import { ProfileReviewScreen } from './profile-review-screen';

export interface ProfileOnboardingFlowProps {
  onDiscover?: (() => void) | undefined;
  captureLocation: () => Promise<LocationUpdate>;
  completePhotos: (photoIds: string[]) => Promise<CompletedProfilePhotos>;
  completePrompts: (prompts: ProfilePromptAnswerInput[]) => Promise<CompletedProfilePrompts>;
  initialUser: CurrentUser;
  loadPhotos: () => Promise<ProfilePhoto[]>;
  loadProfileReview: () => Promise<ProfileReview>;
  loadPrompts: () => Promise<ProfilePromptAnswer[]>;
  pickPhoto: () => Promise<LocalProfilePhoto | null>;
  removePhoto: (photoId: string) => Promise<ProfilePhoto[]>;
  publishProfile: () => Promise<ProfileReview>;
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
  | 'height'
  | 'identity'
  | 'intro'
  | 'location'
  | 'name'
  | 'photos'
  | 'prompts'
  | 'preferences'
  | 'review';

function getInitialVisibleStep(user: CurrentUser): VisibleStep {
  if (user.onboardingStatus === 'NOT_STARTED') {
    return 'intro';
  }

  if (user.onboardingStep === 'NAME') {
    return 'name';
  }

  const checkpointSteps: Record<CurrentUser['onboardingStep'], VisibleStep> = {
    BIRTHDAY: 'birthday',
    COMPLETE: 'review',
    DETAILS: 'height',
    IDENTITY: 'identity',
    LOCATION: 'location',
    NAME: 'name',
    PHOTOS: 'photos',
    PREFERENCES: 'preferences',
    PROMPTS: 'prompts',
    REVIEW: 'review',
  };

  return checkpointSteps[user.onboardingStep];
}

export function ProfileOnboardingFlow({
  onDiscover,
  captureLocation,
  completePhotos,
  completePrompts,
  initialUser,
  loadPhotos,
  loadProfileReview,
  loadPrompts,
  pickPhoto,
  removePhoto,
  publishProfile,
  saveBirthDate,
  saveDisplayName,
  saveHeight,
  saveIdentity,
  saveLocation,
  savePreferences,
  uploadPhoto,
}: ProfileOnboardingFlowProps) {
  const [profile, setProfile] = useState<ProfileCheckpoint>();
  const [isEditingFromReview, setIsEditingFromReview] = useState(false);
  const [visibleStep, setVisibleStep] = useState<VisibleStep>(() =>
    getInitialVisibleStep(initialUser),
  );
  const completeStep = (nextStep: VisibleStep) => {
    if (isEditingFromReview) {
      setIsEditingFromReview(false);
      setVisibleStep('review');
      return;
    }

    setVisibleStep(nextStep);
  };
  const backFromEdit = (fallback: VisibleStep) => () => {
    if (isEditingFromReview) {
      setIsEditingFromReview(false);
      setVisibleStep('review');
      return;
    }

    setVisibleStep(fallback);
  };
  const editFromReview = (step: VisibleStep, reviewProfile: ProfileCheckpoint) => {
    setProfile(reviewProfile);
    setIsEditingFromReview(true);
    setVisibleStep(step);
  };

  if (visibleStep === 'intro') {
    return <ProfileOnboardingIntroScreen onContinue={() => setVisibleStep('name')} />;
  }

  if (visibleStep === 'name') {
    return (
      <DisplayNameScreen
        initialValue={profile?.displayName ?? undefined}
        onBack={backFromEdit('intro')}
        onSave={async (name) => {
          const checkpoint = await saveDisplayName(name);
          setProfile(checkpoint);
          completeStep('birthday');
        }}
      />
    );
  }

  if (visibleStep === 'birthday') {
    return (
      <BirthdayScreen
        initialValue={profile?.birthDate ?? undefined}
        onBack={
          isEditingFromReview
            ? backFromEdit('name')
            : profile?.displayName == null
              ? undefined
              : () => setVisibleStep('name')
        }
        onSave={async (birthDate) => {
          const checkpoint = await saveBirthDate(birthDate);
          setProfile(checkpoint);
          completeStep('identity');
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
        onBack={
          isEditingFromReview
            ? backFromEdit('birthday')
            : profile?.birthDate == null
              ? undefined
              : () => setVisibleStep('birthday')
        }
        onSave={async (identity) => {
          const checkpoint = await saveIdentity(identity);
          setProfile(checkpoint);
          completeStep('preferences');
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
        onBack={
          isEditingFromReview
            ? backFromEdit('identity')
            : profile?.genderIdentity == null
              ? undefined
              : () => setVisibleStep('identity')
        }
        onSave={async (preferences) => {
          const checkpoint = await savePreferences(preferences);
          setProfile(checkpoint);
          completeStep('location');
        }}
      />
    );
  }

  if (visibleStep === 'location') {
    return (
      <LocationScreen
        captureLocation={captureLocation}
        onBack={
          isEditingFromReview
            ? backFromEdit('preferences')
            : profile?.relationshipIntent == null
              ? undefined
              : () => setVisibleStep('preferences')
        }
        onSave={async (location) => {
          const checkpoint = await saveLocation(location);
          setProfile(checkpoint);
          completeStep('height');
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
        onBack={
          isEditingFromReview
            ? backFromEdit('location')
            : profile?.hasLocation === true
              ? () => setVisibleStep('location')
              : undefined
        }
        onSave={async (height) => {
          const checkpoint = await saveHeight(height);
          setProfile(checkpoint);
          completeStep('photos');
        }}
      />
    );
  }

  if (visibleStep === 'photos') {
    return (
      <ProfilePhotosScreen
        completePhotos={async (photoIds) => {
          await completePhotos(photoIds);
          completeStep('prompts');
        }}
        loadPhotos={loadPhotos}
        onBack={
          isEditingFromReview
            ? backFromEdit('height')
            : profile?.heightCm == null
              ? undefined
              : () => setVisibleStep('height')
        }
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
          setIsEditingFromReview(false);
          setVisibleStep('review');
        }}
        loadPrompts={loadPrompts}
        onBack={isEditingFromReview ? backFromEdit('photos') : () => setVisibleStep('photos')}
      />
    );
  }

  return (
    <ProfileReviewScreen
      onDiscover={onDiscover}
      loadProfileReview={loadProfileReview}
      onEditBirthday={(reviewProfile) => editFromReview('birthday', reviewProfile)}
      onEditHeight={(reviewProfile) => editFromReview('height', reviewProfile)}
      onEditIdentity={(reviewProfile) => editFromReview('identity', reviewProfile)}
      onEditLocation={(reviewProfile) => editFromReview('location', reviewProfile)}
      onEditName={(reviewProfile) => editFromReview('name', reviewProfile)}
      onEditPhotos={(reviewProfile) => editFromReview('photos', reviewProfile)}
      onEditPreferences={(reviewProfile) => editFromReview('preferences', reviewProfile)}
      onEditPrompts={(reviewProfile) => editFromReview('prompts', reviewProfile)}
      publishProfile={publishProfile}
    />
  );
}
