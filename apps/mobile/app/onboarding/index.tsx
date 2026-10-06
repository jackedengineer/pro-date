import { useAuth } from '@clerk/expo';
import type {
  HeightUpdate,
  IdentityUpdate,
  LocationUpdate,
  PreferencesUpdate,
} from '@pro-date/contracts';
import { Redirect } from 'expo-router';
import { useCallback } from 'react';

import { bootstrapCurrentUser } from '../../src/api/current-user';
import {
  saveProfileBirthDate,
  saveProfileDisplayName,
  saveProfileHeight,
  saveProfileIdentity,
  saveProfileLocation,
  saveProfilePreferences,
} from '../../src/api/profile';
import {
  addProfilePhoto,
  completeProfilePhotos,
  listProfilePhotos,
  type LocalProfilePhoto,
} from '../../src/api/profile-photos';
import { apiBaseUrl, isClerkConfigured } from '../../src/config/public-env';
import { AuthCompleteScreen } from '../../src/features/auth/auth-complete-screen';
import { CurrentUserBootstrapScreen } from '../../src/features/onboarding/current-user-bootstrap-screen';
import { captureProfileLocation } from '../../src/features/onboarding/device-location';
import { pickProfilePhoto } from '../../src/features/onboarding/profile-photo-picker';

export default function OnboardingRoute() {
  if (!isClerkConfigured) {
    return <Redirect href="/" />;
  }

  return <ConfiguredOnboardingRoute />;
}

function ConfiguredOnboardingRoute() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const bootstrap = useCallback(() => {
    if (apiBaseUrl === null) {
      return Promise.reject(new Error('The ProDate API is not configured.'));
    }

    return bootstrapCurrentUser({ apiBaseUrl, getToken });
  }, [getToken]);
  const saveDisplayName = useCallback(
    (displayName: string) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfileDisplayName({ apiBaseUrl, displayName, getToken });
    },
    [getToken],
  );
  const saveBirthDate = useCallback(
    (birthDate: string) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfileBirthDate({ apiBaseUrl, birthDate, getToken });
    },
    [getToken],
  );
  const saveIdentity = useCallback(
    (identity: IdentityUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfileIdentity({ apiBaseUrl, getToken, ...identity });
    },
    [getToken],
  );
  const savePreferences = useCallback(
    (preferences: PreferencesUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfilePreferences({ apiBaseUrl, getToken, ...preferences });
    },
    [getToken],
  );
  const saveLocation = useCallback(
    (location: LocationUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfileLocation({ apiBaseUrl, getToken, ...location });
    },
    [getToken],
  );
  const saveHeight = useCallback(
    (height: HeightUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return saveProfileHeight({ apiBaseUrl, getToken, ...height });
    },
    [getToken],
  );
  const loadPhotos = useCallback(() => {
    if (apiBaseUrl === null) {
      return Promise.reject(new Error('The ProDate API is not configured.'));
    }

    return listProfilePhotos({ apiBaseUrl, getToken });
  }, [getToken]);
  const uploadPhoto = useCallback(
    (photo: LocalProfilePhoto, position: number) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return addProfilePhoto({ apiBaseUrl, getToken, photo, position });
    },
    [getToken],
  );
  const completePhotos = useCallback(
    (photoIds: string[]) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The ProDate API is not configured.'));
      }

      return completeProfilePhotos({ apiBaseUrl, getToken, photoIds });
    },
    [getToken],
  );

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/" />;
  }

  return apiBaseUrl === null ? (
    <AuthCompleteScreen />
  ) : (
    <CurrentUserBootstrapScreen
      bootstrap={bootstrap}
      captureLocation={captureProfileLocation}
      completePhotos={completePhotos}
      loadPhotos={loadPhotos}
      pickPhoto={pickProfilePhoto}
      saveBirthDate={saveBirthDate}
      saveDisplayName={saveDisplayName}
      saveHeight={saveHeight}
      saveIdentity={saveIdentity}
      saveLocation={saveLocation}
      savePreferences={savePreferences}
      uploadPhoto={uploadPhoto}
    />
  );
}
