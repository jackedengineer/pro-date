import { profileReviewSchema, type ProfileReview } from '@pro-date/contracts';
import {
  findMissingProfileSections,
  ProfileIncompleteError,
  type ProfilePublicationRecord,
} from '@pro-date/database';

import type { ProfilePhotoService } from '../media/profile-photo-service.js';
import type { ProfilePromptService } from './profile-prompt-service.js';

export interface ProfilePublicationRepository {
  find: (userId: string) => Promise<ProfilePublicationRecord | null>;
  publish: (userId: string) => Promise<ProfilePublicationRecord>;
}

export interface ProfilePublicationService {
  get: (userId: string) => Promise<ProfileReview>;
  publish: (userId: string) => Promise<ProfileReview>;
}

type ProfilePhotoReader = Pick<ProfilePhotoService, 'list'>;
type ProfilePromptReader = Pick<ProfilePromptService, 'list'>;

export function createProfilePublicationService(
  repository: ProfilePublicationRepository,
  photoService: ProfilePhotoReader,
  promptService: ProfilePromptReader,
): ProfilePublicationService {
  const assembleReview = async (userId: string, record: ProfilePublicationRecord) => {
    const [photos, prompts] = await Promise.all([
      photoService.list(userId),
      promptService.list(userId),
    ]);

    return profileReviewSchema.parse({
      missingSections: findMissingProfileSections(
        record.profile,
        photos.map((photo) => photo.position),
        prompts.map((prompt) => prompt.position),
      ),
      photos,
      profile: record.profile,
      prompts,
      publishedAt: record.publishedAt?.toISOString() ?? null,
    });
  };

  return {
    async get(userId) {
      const record = await repository.find(userId);

      if (record === null) {
        throw new ProfileIncompleteError(['BASICS', 'PHOTOS', 'PROMPTS']);
      }

      return assembleReview(userId, record);
    },

    async publish(userId) {
      return assembleReview(userId, await repository.publish(userId));
    },
  };
}
