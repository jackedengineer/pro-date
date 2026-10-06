import type { OnboardingStatus, OnboardingStep } from '@pro-date/contracts';
import { eq, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { profiles, users } from './schema.js';

type ProfileInsertDatabase = Pick<ProDateDatabase, 'insert'>;
type ProfileUpdateDatabase = Pick<ProDateDatabase, 'update'>;

export interface ProfileCheckpointRecord {
  displayName: string;
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
    .returning({ displayName: profiles.displayName });
}

export function buildOnboardingProgressQuery(database: ProfileUpdateDatabase, userId: string) {
  return database
    .update(users)
    .set({
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'BIRTHDAY',
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
        const [progress] = await buildOnboardingProgressQuery(transaction, userId);

        if (profile?.displayName === null || profile?.displayName === undefined) {
          throw new Error('The profile could not be persisted.');
        }

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        return {
          displayName: profile.displayName,
          onboardingStatus: progress.onboardingStatus,
          onboardingStep: progress.onboardingStep,
        };
      });
    },
  };
}
