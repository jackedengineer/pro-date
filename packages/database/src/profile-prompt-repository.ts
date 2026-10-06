import type { OnboardingStep, ProfilePromptAnswerInput } from '@pro-date/contracts';
import { asc, eq } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { buildOnboardingProgressQuery } from './profile-repository.js';
import { profilePromptAnswers } from './schema.js';

type ProfilePromptDeleteDatabase = Pick<ProDateDatabase, 'delete'>;
type ProfilePromptInsertDatabase = Pick<ProDateDatabase, 'insert'>;
type ProfilePromptReadDatabase = Pick<ProDateDatabase, 'select'>;

const profilePromptSelection = {
  answer: profilePromptAnswers.answer,
  id: profilePromptAnswers.id,
  position: profilePromptAnswers.position,
  promptId: profilePromptAnswers.promptId,
};

export type ProfilePromptAnswerRecord = {
  [Key in keyof typeof profilePromptSelection]: (typeof profilePromptSelection)[Key]['_']['data'];
};

export function buildProfilePromptDeleteQuery(
  database: ProfilePromptDeleteDatabase,
  userId: string,
) {
  return database.delete(profilePromptAnswers).where(eq(profilePromptAnswers.userId, userId));
}

export function buildProfilePromptInsertQuery(
  database: ProfilePromptInsertDatabase,
  userId: string,
  prompts: ProfilePromptAnswerInput[],
) {
  return database
    .insert(profilePromptAnswers)
    .values(prompts.map((prompt) => ({ ...prompt, userId })))
    .returning(profilePromptSelection);
}

export function buildProfilePromptListQuery(database: ProfilePromptReadDatabase, userId: string) {
  return database
    .select(profilePromptSelection)
    .from(profilePromptAnswers)
    .where(eq(profilePromptAnswers.userId, userId))
    .orderBy(asc(profilePromptAnswers.position));
}

export function createProfilePromptRepository(database: ProDateDatabase) {
  return {
    async complete(userId: string, prompts: ProfilePromptAnswerInput[]) {
      return database.transaction(async (transaction) => {
        await buildProfilePromptDeleteQuery(transaction, userId);
        await buildProfilePromptInsertQuery(transaction, userId, prompts);
        const [progress] = await buildOnboardingProgressQuery(transaction, userId, 'REVIEW');

        if (progress === undefined) {
          throw new Error('The onboarding checkpoint could not be persisted.');
        }

        const answers = await buildProfilePromptListQuery(transaction, userId);

        return { answers, onboardingStep: progress.onboardingStep satisfies OnboardingStep };
      });
    },

    list(userId: string): Promise<ProfilePromptAnswerRecord[]> {
      return buildProfilePromptListQuery(database, userId);
    },
  };
}
