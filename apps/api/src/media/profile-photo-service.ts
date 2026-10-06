import type {
  CreateProfilePhotoRequest,
  OnboardingStep,
  ProfilePhoto,
  ProfilePhotoUploadIntentResponse,
} from '@pro-date/contracts';
import type { NewProfilePhotoRecord, ProfilePhotoRecord } from '@pro-date/database';

import type { ConfirmedProfilePhoto } from './profile-photo-provider.js';

type UploadIntent = ProfilePhotoUploadIntentResponse['data'];

export interface ProfilePhotoProvider {
  confirmUpload: (
    userId: string,
    upload: CreateProfilePhotoRequest,
  ) => Promise<ConfirmedProfilePhoto>;
  createUploadIntent: (userId: string) => UploadIntent;
  getDeliveryUrl: (publicId: string, version: number) => string;
}

export interface ProfilePhotoRepository {
  complete: (
    userId: string,
    photoIds: string[],
  ) => Promise<{ onboardingStep: OnboardingStep; photos: ProfilePhotoRecord[] }>;
  list: (userId: string) => Promise<ProfilePhotoRecord[]>;
  save: (userId: string, photo: NewProfilePhotoRecord) => Promise<ProfilePhotoRecord>;
}

export interface ProfilePhotoService {
  add: (userId: string, upload: CreateProfilePhotoRequest) => Promise<ProfilePhoto[]>;
  complete: (
    userId: string,
    photoIds: string[],
  ) => Promise<{ onboardingStep: OnboardingStep; photos: ProfilePhoto[] }>;
  createUploadIntent: (userId: string) => UploadIntent;
  list: (userId: string) => Promise<ProfilePhoto[]>;
}

function toProfilePhoto(photo: ProfilePhotoRecord, provider: ProfilePhotoProvider): ProfilePhoto {
  return {
    deliveryUrl: provider.getDeliveryUrl(photo.providerPublicId, photo.providerVersion),
    height: photo.height,
    id: photo.id,
    position: photo.position,
    width: photo.width,
  };
}

export function createProfilePhotoService(
  provider: ProfilePhotoProvider,
  repository: ProfilePhotoRepository,
): ProfilePhotoService {
  const list = async (userId: string) =>
    (await repository.list(userId)).map((photo) => toProfilePhoto(photo, provider));

  return {
    async add(userId, upload) {
      const confirmed = await provider.confirmUpload(userId, upload);
      await repository.save(userId, {
        bytes: confirmed.bytes,
        format: confirmed.format,
        height: confirmed.height,
        position: confirmed.position,
        providerAssetId: confirmed.providerAssetId,
        providerPublicId: confirmed.providerPublicId,
        providerVersion: confirmed.providerVersion,
        width: confirmed.width,
      });

      return list(userId);
    },

    async complete(userId, photoIds) {
      const result = await repository.complete(userId, photoIds);

      return {
        onboardingStep: result.onboardingStep,
        photos: result.photos.map((photo) => toProfilePhoto(photo, provider)),
      };
    },

    createUploadIntent: (userId) => provider.createUploadIntent(userId),
    list,
  };
}
