import type { OnboardingStep } from '@pro-date/contracts';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { buildOnboardingProgressQuery } from './profile-repository.js';
import { profilePhotos } from './schema.js';

type ProfilePhotoInsertDatabase = Pick<ProDateDatabase, 'insert'>;
type ProfilePhotoReadDatabase = Pick<ProDateDatabase, 'select'>;
type ProfilePhotoUpdateDatabase = Pick<ProDateDatabase, 'update'>;

export interface NewProfilePhotoRecord {
  bytes: number;
  format: string;
  height: number;
  position: number;
  providerAssetId: string;
  providerPublicId: string;
  providerVersion: number;
  width: number;
}

const profilePhotoSelection = {
  bytes: profilePhotos.bytes,
  format: profilePhotos.format,
  height: profilePhotos.height,
  id: profilePhotos.id,
  position: profilePhotos.position,
  providerAssetId: profilePhotos.providerAssetId,
  providerPublicId: profilePhotos.providerPublicId,
  providerVersion: profilePhotos.providerVersion,
  width: profilePhotos.width,
};

export type ProfilePhotoRecord = {
  [Key in keyof typeof profilePhotoSelection]: (typeof profilePhotoSelection)[Key]['_']['data'];
};

export function buildProfilePhotoInsertQuery(
  database: ProfilePhotoInsertDatabase,
  userId: string,
  photo: NewProfilePhotoRecord,
) {
  return database
    .insert(profilePhotos)
    .values({ ...photo, userId })
    .returning(profilePhotoSelection);
}

export function buildProfilePhotoListQuery(database: ProfilePhotoReadDatabase, userId: string) {
  return database
    .select(profilePhotoSelection)
    .from(profilePhotos)
    .where(eq(profilePhotos.userId, userId))
    .orderBy(profilePhotos.position);
}

export function buildProfilePhotoOrderUpdateQuery(
  database: ProfilePhotoUpdateDatabase,
  userId: string,
  photoIds: string[],
) {
  const positions = photoIds.map(
    (photoId, position) => sql`when ${photoId}::uuid then ${position}::smallint`,
  );

  return database
    .update(profilePhotos)
    .set({
      position: sql<number>`case ${profilePhotos.id} ${sql.join(positions, sql.raw(' '))} else ${profilePhotos.position} end`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(profilePhotos.userId, userId), inArray(profilePhotos.id, photoIds)))
    .returning(profilePhotoSelection);
}

export function createProfilePhotoRepository(database: ProDateDatabase) {
  return {
    async complete(userId: string, photoIds: string[]) {
      return database.transaction(async (transaction) => {
        const ownedPhotos = await transaction
          .select({ id: profilePhotos.id })
          .from(profilePhotos)
          .where(and(eq(profilePhotos.userId, userId), inArray(profilePhotos.id, photoIds)));

        if (ownedPhotos.length !== photoIds.length) {
          throw new Error('Every profile photo must belong to the current user.');
        }

        await transaction.execute(
          sql`set constraints profile_photos_user_position_unique deferred`,
        );
        await buildProfilePhotoOrderUpdateQuery(transaction, userId, photoIds);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'PROMPTS');

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        const photos = await buildProfilePhotoListQuery(transaction, userId);

        return { onboardingStep: progress.onboardingStep satisfies OnboardingStep, photos };
      });
    },

    async list(userId: string): Promise<ProfilePhotoRecord[]> {
      return buildProfilePhotoListQuery(database, userId);
    },

    async save(userId: string, photo: NewProfilePhotoRecord): Promise<ProfilePhotoRecord> {
      const [savedPhoto] = await buildProfilePhotoInsertQuery(database, userId, photo);

      if (savedPhoto === undefined) {
        throw new Error('The profile photo could not be persisted.');
      }

      return savedPhoto;
    },
  };
}
