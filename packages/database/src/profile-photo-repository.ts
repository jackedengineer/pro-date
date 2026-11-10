import { PROFILE_PHOTO_MIN_COUNT, type OnboardingStep } from '@pro-date/contracts';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { buildOnboardingProgressQuery } from './profile-repository.js';
import { profilePhotos, profiles, pullRequests } from './schema.js';

type ProfilePhotoInsertDatabase = Pick<ProDateDatabase, 'insert'>;
type ProfilePhotoReadDatabase = Pick<ProDateDatabase, 'select'>;
type ProfilePhotoUpdateDatabase = Pick<ProDateDatabase, 'update'>;
type ProfilePhotoDeleteDatabase = Pick<ProDateDatabase, 'delete'>;

/** A published profile must keep its minimum photos; otherwise it silently leaves discovery. */
export class ProfilePhotoMinimumError extends Error {
  constructor() {
    super('A published profile must keep its minimum number of photos.');
    this.name = 'ProfilePhotoMinimumError';
  }
}

export function assertPhotoRemovalAllowed(isPublished: boolean, photoCount: number): void {
  if (isPublished && photoCount <= PROFILE_PHOTO_MIN_COUNT) throw new ProfilePhotoMinimumError();
}

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

export function buildProfilePhotoFindQuery(
  database: ProfilePhotoReadDatabase,
  userId: string,
  photoId: string,
) {
  return database
    .select(profilePhotoSelection)
    .from(profilePhotos)
    .where(and(eq(profilePhotos.userId, userId), eq(profilePhotos.id, photoId)))
    .limit(1);
}

export function buildProfilePhotoDeleteQuery(
  database: ProfilePhotoDeleteDatabase,
  userId: string,
  photoId: string,
) {
  return database
    .delete(profilePhotos)
    .where(and(eq(profilePhotos.userId, userId), eq(profilePhotos.id, photoId)))
    .returning(profilePhotoSelection);
}

export function buildProfilePhotoCompactQuery(
  database: ProfilePhotoUpdateDatabase,
  userId: string,
  deletedPosition: number,
) {
  return database
    .update(profilePhotos)
    .set({ position: sql<number>`${profilePhotos.position} - 1`, updatedAt: sql`now()` })
    .where(and(eq(profilePhotos.userId, userId), gt(profilePhotos.position, deletedPosition)));
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

/** Every place a Cloudinary profile asset can still be shown: a profile, or a pull request snapshot. */
export function buildReferencedPhotoAssetQueries(
  database: ProfilePhotoReadDatabase,
  publicIds: string[],
) {
  return [
    database
      .select({ publicId: profilePhotos.providerPublicId })
      .from(profilePhotos)
      .where(inArray(profilePhotos.providerPublicId, publicIds)),
    database
      .select({ publicId: pullRequests.photoPublicId })
      .from(pullRequests)
      .where(inArray(pullRequests.photoPublicId, publicIds)),
  ] as const;
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

    async find(userId: string, photoId: string): Promise<ProfilePhotoRecord | null> {
      const [photo] = await buildProfilePhotoFindQuery(database, userId, photoId);

      return photo ?? null;
    },

    async remove(userId: string, photoId: string) {
      return database.transaction(async (transaction) => {
        // Lock this member's photos so concurrent removals cannot both pass the minimum check.
        const owned = await transaction
          .select({ id: profilePhotos.id })
          .from(profilePhotos)
          .where(eq(profilePhotos.userId, userId))
          .for('update');

        if (!owned.some((row) => row.id === photoId)) return null;

        const [profile] = await transaction
          .select({ publishedAt: profiles.publishedAt })
          .from(profiles)
          .where(eq(profiles.userId, userId))
          .limit(1);
        assertPhotoRemovalAllowed(profile?.publishedAt != null, owned.length);

        const [removed] = await buildProfilePhotoDeleteQuery(transaction, userId, photoId);

        if (removed === undefined) return null;

        await transaction.execute(
          sql`set constraints profile_photos_user_position_unique deferred`,
        );
        await buildProfilePhotoCompactQuery(transaction, userId, removed.position);

        // Pull requests snapshot the liked photo; its image must outlive the profile row.
        const reference = await transaction.execute<
          { referenced: boolean } & Record<string, unknown>
        >(
          sql`select exists (select 1 from pull_requests where photo_public_id = ${removed.providerPublicId}) as referenced`,
        );

        return {
          photo: removed,
          photos: await buildProfilePhotoListQuery(transaction, userId),
          assetReferenced: reference.rows[0]?.referenced === true,
        };
      });
    },

    /** The subset of `publicIds` that a profile or pull request still references. */
    async referencedAssets(publicIds: string[]): Promise<Set<string>> {
      if (publicIds.length === 0) return new Set();
      const [photoRows, pullRequestRows] = await Promise.all(
        buildReferencedPhotoAssetQueries(database, publicIds),
      );
      return new Set(
        [...photoRows, ...pullRequestRows]
          .map((row) => row.publicId)
          .filter((publicId): publicId is string => publicId !== null),
      );
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
