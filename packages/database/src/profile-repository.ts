import type {
  HeightUpdate,
  IdentityUpdate,
  LocationUpdate,
  OnboardingStatus,
  OnboardingStep,
  PreferencesUpdate,
  ProfileResponse,
} from '@pro-date/contracts';
import { eq, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { profiles, users } from './schema.js';

type ProfileInsertDatabase = Pick<ProDateDatabase, 'insert'>;
type ProfileUpdateDatabase = Pick<ProDateDatabase, 'update'>;

export type ProfileCheckpointRecord = ProfileResponse['data'];

const profileDraftSelection = {
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
  pronouns: profiles.pronouns,
  relationshipIntent: profiles.relationshipIntent,
};

function formatLocationLabel(locality: string | null, region: string | null): string | null {
  const parts = [locality, region].filter(
    (part, index, values): part is string => part !== null && values.indexOf(part) === index,
  );

  return parts.length === 0 ? null : parts.join(', ');
}

function toProfileCheckpoint(
  profile: {
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
    pronouns: string | null;
    relationshipIntent: string | null;
  },
  progress: Pick<ProfileCheckpointRecord, 'onboardingStatus' | 'onboardingStep'>,
): ProfileCheckpointRecord {
  return {
    arePronounsVisible: profile.arePronounsVisible,
    birthDate: profile.birthDate,
    displayName: profile.displayName,
    genderIdentity: profile.genderIdentity,
    hasLocation: profile.hasLocation,
    heightCm: profile.heightCm,
    interestedIn: profile.interestedIn as ProfileCheckpointRecord['interestedIn'],
    isGenderVisible: profile.isGenderVisible,
    isHeightVisible: profile.isHeightVisible,
    locationLabel: formatLocationLabel(profile.locationLocality, profile.locationRegion),
    onboardingStatus: progress.onboardingStatus,
    onboardingStep: progress.onboardingStep,
    pronouns: profile.pronouns,
    relationshipIntent: profile.relationshipIntent as ProfileCheckpointRecord['relationshipIntent'],
  };
}

export function buildProfileUpsertQuery(
  database: ProfileInsertDatabase,
  userId: string,
  displayName: string,
) {
  return database
    .insert(profiles)
    .values({ displayName, userId })
    .onConflictDoUpdate({
      set: { displayName, updatedAt: sql`now()` },
      target: profiles.userId,
    })
    .returning(profileDraftSelection);
}

export function buildBirthDateUpsertQuery(
  database: ProfileInsertDatabase,
  userId: string,
  birthDate: string,
) {
  return database
    .insert(profiles)
    .values({ birthDate, userId })
    .onConflictDoUpdate({
      set: { birthDate, updatedAt: sql`now()` },
      target: profiles.userId,
    })
    .returning(profileDraftSelection);
}

export function buildIdentityUpsertQuery(
  database: ProfileInsertDatabase,
  userId: string,
  identity: IdentityUpdate,
) {
  const values = {
    arePronounsVisible: identity.arePronounsVisible,
    genderIdentity: identity.genderIdentity,
    isGenderVisible: identity.isGenderVisible,
    pronouns: identity.pronouns,
  };

  return database
    .insert(profiles)
    .values({ ...values, userId })
    .onConflictDoUpdate({ set: { ...values, updatedAt: sql`now()` }, target: profiles.userId })
    .returning(profileDraftSelection);
}

export function buildPreferencesUpsertQuery(
  database: ProfileInsertDatabase,
  userId: string,
  preferences: PreferencesUpdate,
) {
  const values = {
    interestedIn: preferences.interestedIn,
    relationshipIntent: preferences.relationshipIntent,
  };

  return database
    .insert(profiles)
    .values({ ...values, userId })
    .onConflictDoUpdate({ set: { ...values, updatedAt: sql`now()` }, target: profiles.userId })
    .returning(profileDraftSelection);
}

export function buildLocationUpsertQuery(
  database: ProfileInsertDatabase,
  userId: string,
  location: LocationUpdate,
) {
  const point = sql`ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography`;
  const values = {
    location: point,
    locationCountryCode: location.countryCode,
    locationLocality: location.locality,
    locationRegion: location.region,
  };

  return database
    .insert(profiles)
    .values({ ...values, userId })
    .onConflictDoUpdate({ set: { ...values, updatedAt: sql`now()` }, target: profiles.userId })
    .returning(profileDraftSelection);
}

export function buildHeightUpsertQuery(
  database: ProfileInsertDatabase,
  userId: string,
  height: HeightUpdate,
) {
  const values = { heightCm: height.centimeters, isHeightVisible: height.isVisible };

  return database
    .insert(profiles)
    .values({ ...values, userId })
    .onConflictDoUpdate({ set: { ...values, updatedAt: sql`now()` }, target: profiles.userId })
    .returning(profileDraftSelection);
}

export function buildOnboardingProgressQuery(
  database: ProfileUpdateDatabase,
  userId: string,
  nextStep: OnboardingStep,
) {
  return database
    .update(users)
    .set({
      onboardingStatus: sql<OnboardingStatus>`greatest(${users.onboardingStatus}, ${'IN_PROGRESS'}::onboarding_status)`,
      onboardingStep: sql<OnboardingStep>`greatest(${users.onboardingStep}, ${nextStep}::onboarding_step)`,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId))
    .returning({
      onboardingStatus: users.onboardingStatus,
      onboardingStep: users.onboardingStep,
    });
}

export function createProfileRepository(database: ProDateDatabase) {
  return {
    async saveDisplayName(userId: string, displayName: string): Promise<ProfileCheckpointRecord> {
      return database.transaction(async (transaction) => {
        const [profile] = await buildProfileUpsertQuery(transaction, userId, displayName);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'BIRTHDAY');

        if (profile?.displayName === null || profile?.displayName === undefined) {
          throw new Error('The profile could not be persisted.');
        }

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        return toProfileCheckpoint(profile, progress);
      });
    },

    async saveBirthDate(userId: string, birthDate: string): Promise<ProfileCheckpointRecord> {
      return database.transaction(async (transaction) => {
        const [profile] = await buildBirthDateUpsertQuery(transaction, userId, birthDate);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'IDENTITY');

        if (profile?.birthDate === null || profile?.birthDate === undefined) {
          throw new Error('The birthday could not be persisted.');
        }

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        return toProfileCheckpoint(profile, progress);
      });
    },

    async saveIdentity(userId: string, identity: IdentityUpdate): Promise<ProfileCheckpointRecord> {
      return database.transaction(async (transaction) => {
        const [profile] = await buildIdentityUpsertQuery(transaction, userId, identity);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'PREFERENCES');

        if (profile === undefined || profile.genderIdentity === null || profile.pronouns === null) {
          throw new Error('The identity details could not be persisted.');
        }

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        return toProfileCheckpoint(profile, progress);
      });
    },

    async savePreferences(
      userId: string,
      preferences: PreferencesUpdate,
    ): Promise<ProfileCheckpointRecord> {
      return database.transaction(async (transaction) => {
        const [profile] = await buildPreferencesUpsertQuery(transaction, userId, preferences);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'LOCATION');

        if (
          profile === undefined ||
          profile.relationshipIntent === null ||
          profile.interestedIn.length === 0
        ) {
          throw new Error('The dating preferences could not be persisted.');
        }

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        return toProfileCheckpoint(profile, progress);
      });
    },

    async saveLocation(userId: string, location: LocationUpdate): Promise<ProfileCheckpointRecord> {
      return database.transaction(async (transaction) => {
        const [profile] = await buildLocationUpsertQuery(transaction, userId, location);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'DETAILS');

        if (profile?.hasLocation !== true || profile.locationLocality === null) {
          throw new Error('The location could not be persisted.');
        }

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        return toProfileCheckpoint(profile, progress);
      });
    },

    async saveHeight(userId: string, height: HeightUpdate): Promise<ProfileCheckpointRecord> {
      return database.transaction(async (transaction) => {
        const [profile] = await buildHeightUpsertQuery(transaction, userId, height);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'PHOTOS');

        if (profile?.heightCm === null || profile?.heightCm === undefined) {
          throw new Error('The height could not be persisted.');
        }

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        return toProfileCheckpoint(profile, progress);
      });
    },
  };
}
