import {
  profilePromptAnswerSchema,
  type OnboardingStep,
  type ProfilePromptAnswer,
  type ProfilePromptAnswerInput,
} from '@pro-date/contracts';
import type { ProfilePromptAnswerRecord } from '@pro-date/database';

export interface ProfilePromptRepository {
  complete: (
    userId: string,
    prompts: ProfilePromptAnswerInput[],
  ) => Promise<{ answers: ProfilePromptAnswerRecord[]; onboardingStep: OnboardingStep }>;
  list: (userId: string) => Promise<ProfilePromptAnswerRecord[]>;
}

export interface ProfilePromptService {
  complete: (
    userId: string,
    prompts: ProfilePromptAnswerInput[],
  ) => Promise<{ answers: ProfilePromptAnswer[]; onboardingStep: OnboardingStep }>;
  list: (userId: string) => Promise<ProfilePromptAnswer[]>;
}

function parseAnswers(records: ProfilePromptAnswerRecord[]): ProfilePromptAnswer[] {
  return records.map((record) => profilePromptAnswerSchema.parse(record));
}

export function createProfilePromptService(
  repository: ProfilePromptRepository,
): ProfilePromptService {
  return {
    async complete(userId, prompts) {
      const result = await repository.complete(userId, prompts);

      return { answers: parseAnswers(result.answers), onboardingStep: result.onboardingStep };
    },
    async list(userId) {
      return parseAnswers(await repository.list(userId));
    },
  };
}
