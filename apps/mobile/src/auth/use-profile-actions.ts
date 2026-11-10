import { useAuth } from '@clerk/expo';
import type {
  HeightUpdate,
  IdentityUpdate,
  LocationUpdate,
  PreferencesUpdate,
  ProfilePromptAnswerInput,
} from '@pro-date/contracts';
import { useCallback, useMemo } from 'react';

import {
  saveProfileBirthDate,
  saveProfileDisplayName,
  saveProfileHeight,
  saveProfileIdentity,
  saveProfileLocation,
  saveProfilePreferences,
} from '../api/profile';
import {
  addProfilePhoto,
  completeProfilePhotos,
  deleteProfilePhoto,
  listProfilePhotos,
  type LocalProfilePhoto,
} from '../api/profile-photos';
import { completeProfilePrompts, listProfilePrompts } from '../api/profile-prompts';
import { loadProfileReview, publishProfile } from '../api/profile-publication';
import { apiBaseUrl } from '../config/public-env';
import { captureProfileLocation } from '../features/onboarding/device-location';
import { pickProfilePhoto } from '../features/onboarding/profile-photo-picker';

/**
 * Every profile read and write, bound to the signed-in session. Shared by profile setup and by
 * editing a single part of a finished profile, so both save through exactly the same calls.
 */
export function useProfileActions() {
  const { getToken } = useAuth();
  const saveDisplayName = useCallback(
    (displayName: string) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return saveProfileDisplayName({ apiBaseUrl, displayName, getToken });
    },
    [getToken],
  );
  const saveBirthDate = useCallback(
    (birthDate: string) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return saveProfileBirthDate({ apiBaseUrl, birthDate, getToken });
    },
    [getToken],
  );
  const saveIdentity = useCallback(
    (identity: IdentityUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return saveProfileIdentity({ apiBaseUrl, getToken, ...identity });
    },
    [getToken],
  );
  const savePreferences = useCallback(
    (preferences: PreferencesUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return saveProfilePreferences({ apiBaseUrl, getToken, ...preferences });
    },
    [getToken],
  );
  const saveLocation = useCallback(
    (location: LocationUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return saveProfileLocation({ apiBaseUrl, getToken, ...location });
    },
    [getToken],
  );
  const saveHeight = useCallback(
    (height: HeightUpdate) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return saveProfileHeight({ apiBaseUrl, getToken, ...height });
    },
    [getToken],
  );
  const loadPhotos = useCallback(() => {
    if (apiBaseUrl === null) {
      return Promise.reject(new Error('The Merge API is not configured.'));
    }

    return listProfilePhotos({ apiBaseUrl, getToken });
  }, [getToken]);
  const uploadPhoto = useCallback(
    (photo: LocalProfilePhoto, position: number) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return addProfilePhoto({ apiBaseUrl, getToken, photo, position });
    },
    [getToken],
  );
  const completePhotos = useCallback(
    (photoIds: string[]) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return completeProfilePhotos({ apiBaseUrl, getToken, photoIds });
    },
    [getToken],
  );
  const removePhoto = useCallback(
    (photoId: string) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return deleteProfilePhoto({ apiBaseUrl, getToken, photoId });
    },
    [getToken],
  );
  const loadPrompts = useCallback(() => {
    if (apiBaseUrl === null) {
      return Promise.reject(new Error('The Merge API is not configured.'));
    }

    return listProfilePrompts({ apiBaseUrl, getToken });
  }, [getToken]);
  const completePrompts = useCallback(
    (prompts: ProfilePromptAnswerInput[]) => {
      if (apiBaseUrl === null) {
        return Promise.reject(new Error('The Merge API is not configured.'));
      }

      return completeProfilePrompts({ apiBaseUrl, getToken, prompts });
    },
    [getToken],
  );
  const loadProfileReviewAction = useCallback(() => {
    if (apiBaseUrl === null) {
      return Promise.reject(new Error('The Merge API is not configured.'));
    }

    return loadProfileReview({ apiBaseUrl, getToken });
  }, [getToken]);
  const publishProfileAction = useCallback(() => {
    if (apiBaseUrl === null) {
      return Promise.reject(new Error('The Merge API is not configured.'));
    }

    return publishProfile({ apiBaseUrl, getToken });
  }, [getToken]);

  return useMemo(
    () => ({
      captureLocation: captureProfileLocation,
      completePhotos,
      completePrompts,
      loadPhotos,
      loadProfileReview: loadProfileReviewAction,
      loadPrompts,
      pickPhoto: pickProfilePhoto,
      publishProfile: publishProfileAction,
      removePhoto,
      saveBirthDate,
      saveDisplayName,
      saveHeight,
      saveIdentity,
      saveLocation,
      savePreferences,
      uploadPhoto,
    }),
    [
      completePhotos,
      completePrompts,
      loadPhotos,
      loadProfileReviewAction,
      loadPrompts,
      publishProfileAction,
      removePhoto,
      saveBirthDate,
      saveDisplayName,
      saveHeight,
      saveIdentity,
      saveLocation,
      savePreferences,
      uploadPhoto,
    ],
  );
}
