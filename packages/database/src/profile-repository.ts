import type { OnboardingStatus, OnboardingStep } from '@pro-date/contracts';
import { eq, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { profiles, users } from './schema.js';

type ProfileInsertDatabase = Pick<ProDateDatabase, 'insert'>;
type ProfileUpdateDatabase = Pick<ProDateDatabase, 'update'>;

export interface ProfileCheckpointRecord {
  birthDate: string | null;
  displayName: string | null;
  onboardingStatus: OnboardingStatus;
  onboardingStep: OnboardingStep;
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
    .returning({ birthDate: profiles.birthDate, displayName: profiles.displayName });
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
    .returning({ birthDate: profiles.birthDate, displayName: profiles.displayName });
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

        return {
          birthDate: profile.birthDate,
          displayName: profile.displayName,
          onboardingStatus: progress.onboardingStatus,
          onboardingStep: progress.onboardingStep,
        };
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

        return {
          birthDate: profile.birthDate,
          displayName: profile.displayName,
          onboardingStatus: progress.onboardingStatus,
          onboardingStep: progress.onboardingStep,
        };
      });
    },
  };
}
