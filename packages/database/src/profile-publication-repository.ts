import type { ProfileReviewMissingSection, ProfileResponse } from '@pro-date/contracts';
import { eq, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { buildProfilePhotoListQuery } from './profile-photo-repository.js';
import { buildProfilePromptListQuery } from './profile-prompt-repository.js';
import { profiles, users } from './schema.js';

type ProfilePublicationReadDatabase = Pick<ProDateDatabase, 'select'>;
type ProfilePublicationUpdateDatabase = Pick<ProDateDatabase, 'update'>;

type ProfileCheckpointRecord = ProfileResponse['data'];

const profilePublicationSelection = {
  arePronounsVisible: profiles.arePronounsVisible,
  birthDate: profiles.birthDate,
  displayName: profiles.displayName,
  genderIdentity: profiles.genderIdentity,
  hasLocation: sql<boolean>`${profiles.location} is not null`,
  heightCm: profiles.heightCm,
  interestedIn: profiles.interestedIn,
  isGenderVisible: profiles.isGenderVisible,
  isHeightVisible: profiles.isHeightVisible,
  locationLocality: profiles.locationLocality,
  locationRegion: profiles.locationRegion,
  onboardingStatus: users.onboardingStatus,
  onboardingStep: users.onboardingStep,
  pronouns: profiles.pronouns,
  publishedAt: profiles.publishedAt,
  relationshipIntent: profiles.relationshipIntent,
};

interface ProfilePublicationRow {
  arePronounsVisible: boolean;
  birthDate: string | null;
  displayName: string | null;
  genderIdentity: string | null;
  hasLocation: boolean;
  heightCm: number | null;
  interestedIn: string[];
  isGenderVisible: boolean;
  isHeightVisible: boolean;
  locationLocality: string | null;
  locationRegion: string | null;
  onboardingStatus: ProfileCheckpointRecord['onboardingStatus'];
  onboardingStep: ProfileCheckpointRecord['onboardingStep'];
  pronouns: string | null;
  publishedAt: Date | null;
  relationshipIntent: string | null;
}

export interface ProfilePublicationRecord {
  profile: ProfileCheckpointRecord;
  publishedAt: Date | null;
}

export class ProfileIncompleteError extends Error {
  readonly missingSections: ProfileReviewMissingSection[];

  constructor(missingSections: ProfileReviewMissingSection[]) {
    super('The profile is not ready to publish.');
    this.name = 'ProfileIncompleteError';
    this.missingSections = missingSections;
  }
}

function formatLocationLabel(locality: string | null, region: string | null): string | null {
  const parts = [locality, region].filter(
    (part, index, values): part is string => part !== null && values.indexOf(part) === index,
  );

  return parts.length === 0 ? null : parts.join(', ');
}

function toProfilePublicationRecord(row: ProfilePublicationRow): ProfilePublicationRecord {
  return {
    profile: {
      arePronounsVisible: row.arePronounsVisible,
      birthDate: row.birthDate,
      displayName: row.displayName,
      genderIdentity: row.genderIdentity,
      hasLocation: row.hasLocation,
      heightCm: row.heightCm,
      interestedIn: row.interestedIn as ProfileCheckpointRecord['interestedIn'],
      isGenderVisible: row.isGenderVisible,
      isHeightVisible: row.isHeightVisible,
      locationLabel: formatLocationLabel(row.locationLocality, row.locationRegion),
      onboardingStatus: row.onboardingStatus,
      onboardingStep: row.onboardingStep,
      pronouns: row.pronouns,
      relationshipIntent: row.relationshipIntent as ProfileCheckpointRecord['relationshipIntent'],
    },
    publishedAt: row.publishedAt,
  };
}

function hasContiguousPositions(positions: number[], minimumCount: number): boolean {
  return (
    positions.length >= minimumCount && positions.every((position, index) => position === index)
  );
}

export function findMissingProfileSections(
  profile: ProfileCheckpointRecord | null,
  photoPositions: number[],
  promptPositions: number[],
): ProfileReviewMissingSection[] {
  const missingSections: ProfileReviewMissingSection[] = [];
  const basicsComplete =
    profile !== null &&
    profile.displayName !== null &&
    profile.birthDate !== null &&
    profile.genderIdentity !== null &&
    profile.pronouns !== null &&
    profile.interestedIn.length > 0 &&
    profile.relationshipIntent !== null &&
    profile.hasLocation &&
    profile.heightCm !== null;

  if (!basicsComplete) missingSections.push('BASICS');
  if (!hasContiguousPositions(photoPositions, 4)) missingSections.push('PHOTOS');
  if (promptPositions.length !== 3 || !hasContiguousPositions(promptPositions, 3)) {
    missingSections.push('PROMPTS');
  }

  return missingSections;
}

export function buildProfilePublicationStateQuery(
  database: ProfilePublicationReadDatabase,
  userId: string,
) {
  return database
    .select(profilePublicationSelection)
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.userId, userId))
    .limit(1);
}

export function buildProfilePublicationQuery(
  database: ProfilePublicationUpdateDatabase,
  userId: string,
) {
  return database
    .update(profiles)
    .set({ publishedAt: sql`coalesce(${profiles.publishedAt}, now())`, updatedAt: sql`now()` })
    .where(eq(profiles.userId, userId))
    .returning({ publishedAt: profiles.publishedAt });
}

export function buildProfileCompletionQuery(
  database: ProfilePublicationUpdateDatabase,
  userId: string,
) {
  return database
    .update(users)
    .set({ onboardingStatus: 'COMPLETE', onboardingStep: 'COMPLETE', updatedAt: sql`now()` })
    .where(eq(users.id, userId));
}

export function createProfilePublicationRepository(database: ProDateDatabase) {
  return {
    async find(userId: string): Promise<ProfilePublicationRecord | null> {
      const [row] = await buildProfilePublicationStateQuery(database, userId);

      return row === undefined ? null : toProfilePublicationRecord(row);
    },

    async publish(userId: string): Promise<ProfilePublicationRecord> {
      return database.transaction(async (transaction) => {
        const [row] = await buildProfilePublicationStateQuery(transaction, userId).for('update');
        const photos = await buildProfilePhotoListQuery(transaction, userId);
        const prompts = await buildProfilePromptListQuery(transaction, userId);
        const profile = row === undefined ? null : toProfilePublicationRecord(row).profile;
        const missingSections = findMissingProfileSections(
          profile,
          photos.map((photo) => photo.position),
          prompts.map((prompt) => prompt.position),
        );

        if (missingSections.length > 0 || profile === null) {
          throw new ProfileIncompleteError(missingSections);
        }

        const [publication] = await buildProfilePublicationQuery(transaction, userId);
        await buildProfileCompletionQuery(transaction, userId);

        if (publication?.publishedAt === null || publication?.publishedAt === undefined) {
          throw new Error('The profile publication timestamp could not be persisted.');
        }

        return {
          profile: { ...profile, onboardingStatus: 'COMPLETE', onboardingStep: 'COMPLETE' },
          publishedAt: publication.publishedAt,
        };
      });
    },
  };
}
