import type { OnboardingStatus, OnboardingStep } from '@pro-date/contracts';
import { eq } from 'drizzle-orm';

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

export function buildCurrentUserDeleteQuery(database: ProDateDatabase, clerkSubject: string) {
  return database
    .delete(users)
    .where(eq(users.clerkSubject, clerkSubject))
    .returning({ id: users.id });
}

export function createCurrentUserRepository(database: ProDateDatabase) {
  return {
    async findByClerkSubject(clerkSubject: string): Promise<CurrentUserRecord | null> {
      const [user] = await database
        .select({
          id: users.id,
          onboardingStatus: users.onboardingStatus,
          onboardingStep: users.onboardingStep,
        })
        .from(users)
        .where(eq(users.clerkSubject, clerkSubject))
        .limit(1);
      return user ?? null;
    },
    /**
     * Deletes the member and, through the schema's cascades, everything that belongs to them:
     * profile, photos, prompts, pull requests, matches, messages, blocks, reports and devices.
     * Returns the deleted id, or null when there was no account to delete.
     */
    async deleteByClerkSubject(clerkSubject: string): Promise<string | null> {
      const [deleted] = await buildCurrentUserDeleteQuery(database, clerkSubject);
      return deleted?.id ?? null;
    },
    async findOrCreateByClerkSubject(clerkSubject: string): Promise<CurrentUserRecord> {
      const [currentUser] = await buildCurrentUserUpsertQuery(database, clerkSubject);

      if (currentUser === undefined) {
        throw new Error('The current user could not be persisted.');
      }

      return currentUser;
    },
  };
}
