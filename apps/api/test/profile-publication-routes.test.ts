import {
  apiErrorResponseSchema,
  profileReviewResponseSchema,
  type ProfileReview,
} from '@pro-date/contracts';
import { ProfileIncompleteError } from '@pro-date/database';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApiApp, type ApiAppOptions } from '../src/app.js';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const review: ProfileReview = {
  missingSections: [],
  photos: Array.from({ length: 4 }, (_, position) => ({
    deliveryUrl: `https://res.cloudinary.com/pro-date-dev/image/upload/profile-${position}.jpg`,
    height: 1600,
    id: `00000000-0000-4000-8000-${(position + 1).toString().padStart(12, '0')}`,
    position,
    width: 1200,
  })),
  profile: {
    arePronounsVisible: true,
    birthDate: '1998-08-19',
    displayName: 'Avery',
    genderIdentity: 'Non-binary',
    hasLocation: true,
    heightCm: 173,
    interestedIn: ['WOMEN'],
    isGenderVisible: true,
    isHeightVisible: true,
    locationLabel: 'Bengaluru, Karnataka',
    onboardingStatus: 'IN_PROGRESS',
    onboardingStep: 'REVIEW',
    pronouns: 'they/them',
    relationshipIntent: 'LONG_TERM',
  },
  prompts: [
    {
      answer: 'I build tiny tools that make creative work feel lighter.',
      id: '10000000-0000-4000-8000-000000000001',
      position: 0,
      promptId: 'weekend_build',
    },
    {
      answer: 'Coffee, a long walk, and one wildly specific playlist.',
      id: '10000000-0000-4000-8000-000000000002',
      position: 1,
      promptId: 'debug_bad_day',
    },
    {
      answer: 'Curious questions, kind reviews, and excellent snack choices.',
      id: '10000000-0000-4000-8000-000000000003',
      position: 2,
      promptId: 'merge_criteria',
    },
  ],
  publishedAt: null,
};

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
      onboardingStep: 'REVIEW',
    }),
    resolveClerkSubject: () => 'user_private_clerk_subject',
    ...overrides,
  };
}

describe('profile publication routes', () => {
  it('requires authentication for profile review', async () => {
    const response = await request(createTestApp()).get('/v1/users/me/profile-review').expect(401);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
  });

  it('keeps review unavailable until all earlier onboarding steps are committed', async () => {
    const get = vi.fn();
    const response = await request(
      createTestApp(
        authenticatedOptions({
          findOrCreateCurrentUser: vi.fn().mockResolvedValue({
            id: userId,
            onboardingStatus: 'IN_PROGRESS',
            onboardingStep: 'PROMPTS',
          }),
          profilePublicationService: { get, publish: vi.fn() },
        }),
      ),
    )
      .get('/v1/users/me/profile-review')
      .expect(409);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('ONBOARDING_STEP_REQUIRED');
    expect(get).not.toHaveBeenCalled();
  });

  it('returns the complete server-owned review model', async () => {
    const get = vi.fn().mockResolvedValue(review);
    const response = await request(
      createTestApp(authenticatedOptions({ profilePublicationService: { get, publish: vi.fn() } })),
    )
      .get('/v1/users/me/profile-review')
      .expect(200);

    expect(profileReviewResponseSchema.parse(response.body)).toEqual({ data: review, requestId });
    expect(get).toHaveBeenCalledWith(userId);
  });

  it('publishes an eligible profile idempotently', async () => {
    const publishedReview: ProfileReview = {
      ...review,
      profile: {
        ...review.profile,
        onboardingStatus: 'COMPLETE',
        onboardingStep: 'COMPLETE',
      },
      publishedAt: '2026-10-07T08:45:30.000Z',
    };
    const publish = vi.fn().mockResolvedValue(publishedReview);
    const response = await request(
      createTestApp(authenticatedOptions({ profilePublicationService: { get: vi.fn(), publish } })),
    )
      .put('/v1/users/me/profile-publication')
      .expect(200);

    expect(profileReviewResponseSchema.parse(response.body).data).toEqual(publishedReview);
    expect(publish).toHaveBeenCalledWith(userId);
  });

  it('returns safe missing-section diagnostics for an incomplete profile', async () => {
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePublicationService: {
            get: vi.fn(),
            publish: vi.fn().mockRejectedValue(new ProfileIncompleteError(['PHOTOS'])),
          },
        }),
      ),
    )
      .put('/v1/users/me/profile-publication')
      .expect(409);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'PROFILE_INCOMPLETE',
        details: [
          {
            code: 'missing_section',
            message: 'Complete your profile photos before publishing.',
            path: 'PHOTOS',
          },
        ],
        message: 'Complete the missing profile sections before publishing.',
      },
      requestId,
    });
  });
});
