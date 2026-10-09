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
  deleteUpload: (userId: string, publicId: string) => Promise<void>;
  getDeliveryUrl: (publicId: string, version: number) => string;
}

export interface ProfilePhotoRepository {
  complete: (
    userId: string,
    photoIds: string[],
  ) => Promise<{ onboardingStep: OnboardingStep; photos: ProfilePhotoRecord[] }>;
  list: (userId: string) => Promise<ProfilePhotoRecord[]>;
  find: (userId: string, photoId: string) => Promise<ProfilePhotoRecord | null>;
  remove: (
    userId: string,
    photoId: string,
  ) => Promise<{ photo: ProfilePhotoRecord; photos: ProfilePhotoRecord[] } | null>;
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
  remove: (userId: string, photoId: string) => Promise<ProfilePhoto[] | null>;
}

export class ProfilePhotoSlotConflictError extends Error {
  readonly code = 'PHOTO_SLOT_OCCUPIED';

  constructor() {
    super('That profile photo slot is already occupied.');
    this.name = 'ProfilePhotoSlotConflictError';
  }
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
      const existingPhotos = await repository.list(userId);
      if (
        existingPhotos.some(
          (photo) =>
            photo.providerAssetId === confirmed.providerAssetId &&
            photo.providerPublicId === confirmed.providerPublicId &&
            photo.providerVersion === confirmed.providerVersion,
        )
      ) {
        // A lost confirmation response must not duplicate or delete a persisted/reordered photo.
        return existingPhotos.map((photo) => toProfilePhoto(photo, provider));
      }
      if (existingPhotos.some((photo) => photo.position === confirmed.position)) {
        throw new ProfilePhotoSlotConflictError();
      }

      // Never compensate a failed/unknown database write by deleting the provider asset:
      // it may already be committed or concurrently referenced. Reconcile unreferenced
      // uploads separately after a grace period, rather than risk destroying a saved photo.
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
    async remove(userId, photoId) {
      const photo = await repository.find(userId, photoId);

      if (photo === null) return null;

      await provider.deleteUpload(userId, photo.providerPublicId);
      const result = await repository.remove(userId, photoId);

      return result?.photos.map((remaining) => toProfilePhoto(remaining, provider)) ?? null;
    },
  };
}
