import {
  apiErrorResponseSchema,
  profilePromptListResponseSchema,
  type ProfilePromptAnswer,
  type ProfilePromptAnswerInput,
} from '@pro-date/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApiApp, type ApiAppOptions } from '../src/app.js';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const prompts: ProfilePromptAnswerInput[] = [
  {
    answer: 'I build tiny tools that make creative work feel lighter.',
    position: 0,
    promptId: 'weekend_build',
  },
  {
    answer: 'Coffee, a long walk, and one wildly specific playlist.',
    position: 1,
    promptId: 'debug_bad_day',
  },
  {
    answer: 'Curious questions, kind reviews, and excellent snack choices.',
    position: 2,
    promptId: 'merge_criteria',
  },
];
const savedPrompts: ProfilePromptAnswer[] = prompts.map((prompt, index) => ({
  ...prompt,
  id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, '0')}`,
}));

function createTestApp(options: ApiAppOptions = {}) {
  return createApiApp({
    logger: pino({ level: 'silent' }),
    requestId: () => requestId,
    ...options,
  });
}

function authenticatedOptions(overrides: ApiAppOptions = {}): ApiAppOptions {
  return {
    findOrCreateCurrentUser: vi.fn().mockResolvedValue({
      id: userId,
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'PROMPTS',
    }),
    resolveClerkSubject: () => 'user_private_clerk_subject',
    ...overrides,
  };
}

describe('profile prompt routes', () => {
  it('requires authentication', async () => {
    const response = await request(createTestApp()).get('/v1/users/me/profile-prompts').expect(401);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
  });

  it('does not expose prompt editing before the prompt checkpoint', async () => {
    const complete = vi.fn();
    const response = await request(
      createTestApp(
        authenticatedOptions({
          findOrCreateCurrentUser: vi.fn().mockResolvedValue({
            id: userId,
            onboardingStatus: 'IN_PROGRESS',
            onboardingStep: 'PHOTOS',
          }),
          profilePromptService: { complete, list: vi.fn() },
        }),
      ),
    )
      .put('/v1/users/me/profile-prompts')
      .send({ prompts })
      .expect(409);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('ONBOARDING_STEP_REQUIRED');
    expect(complete).not.toHaveBeenCalled();
  });

  it('lists the saved prompt draft', async () => {
    const list = vi.fn().mockResolvedValue(savedPrompts);
    const response = await request(
      createTestApp(authenticatedOptions({ profilePromptService: { complete: vi.fn(), list } })),
    )
      .get('/v1/users/me/profile-prompts')
      .expect(200);

    expect(profilePromptListResponseSchema.parse(response.body)).toEqual({
      data: savedPrompts,
      onboardingStep: 'PROMPTS',
      requestId,
    });
    expect(list).toHaveBeenCalledWith(userId);
  });

  it('rejects generic or duplicate prompt answers', async () => {
    const complete = vi.fn();
    const response = await request(
      createTestApp(
        authenticatedOptions({ profilePromptService: { complete, list: vi.fn() } }),
      ),
    )
      .put('/v1/users/me/profile-prompts')
      .send({
        prompts: prompts.map((prompt) => ({
          ...prompt,
          answer: 'Coffee.',
          promptId: 'weekend_build',
        })),
      })
      .expect(422);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('VALIDATION_ERROR');
    expect(complete).not.toHaveBeenCalled();
  });

  it('persists three strong answers and advances to review', async () => {
    const complete = vi.fn().mockResolvedValue({
      answers: savedPrompts,
      onboardingStep: 'REVIEW',
    });
    const response = await request(
      createTestApp(
        authenticatedOptions({ profilePromptService: { complete, list: vi.fn() } }),
      ),
    )
      .put('/v1/users/me/profile-prompts')
      .send({ prompts })
      .expect(200);

    expect(profilePromptListResponseSchema.parse(response.body)).toEqual({
      data: savedPrompts,
      onboardingStep: 'REVIEW',
      requestId,
    });
    expect(complete).toHaveBeenCalledWith(userId, prompts);
  });
});
