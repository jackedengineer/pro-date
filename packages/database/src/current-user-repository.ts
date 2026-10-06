import type { OnboardingStatus, OnboardingStep } from '@pro-date/contracts';

import type { ProDateDatabase } from './client.js';
import { users } from './schema.js';

export interface CurrentUserRecord {
  id: string;
  onboardingStep: OnboardingStep;
  onboardingStatus: OnboardingStatus;
}

export function buildCurrentUserUpsertQuery(database: ProDateDatabase, clerkSubject: string) {
  return database
    .insert(users)
    .values({ clerkSubject })
    .onConflictDoUpdate({
      set: { clerkSubject },
      target: users.clerkSubject,
    })
    .returning({
      id: users.id,
      onboardingStatus: users.onboardingStatus,
      onboardingStep: users.onboardingStep,
    });
}

export function createCurrentUserRepository(database: ProDateDatabase) {
  return {
    async findOrCreateByClerkSubject(clerkSubject: string): Promise<CurrentUserRecord> {
      const [currentUser] = await buildCurrentUserUpsertQuery(database, clerkSubject);

      if (currentUser === undefined) {
        throw new Error('The current user could not be persisted.');
      }

      return currentUser;
    },
  };
}
