import { describe, expect, it } from 'vitest';

import {
  type ProfileReviewResponse,
  profileReviewResponseSchema,
} from '../src/profile-publication';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';

function buildReview(): ProfileReviewResponse {
  return {
    data: {
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
        interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
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
    },
    requestId,
  };
}

describe('profile review response', () => {
  it('accepts a complete, unpublished profile review', () => {
    expect(profileReviewResponseSchema.parse(buildReview())).toEqual(buildReview());
  });

  it('tracks only supported incomplete sections', () => {
    const review = buildReview();
    review.data.missingSections = ['PHOTOS'];
    review.data.photos = [];

    expect(profileReviewResponseSchema.parse(review).data.missingSections).toEqual(['PHOTOS']);
    expect(() =>
      profileReviewResponseSchema.parse({
        ...review,
        data: { ...review.data, missingSections: ['PAYMENT'] },
      }),
    ).toThrow();
  });

  it('accepts an immutable publication timestamp after publishing', () => {
    const review = buildReview();
    review.data.profile.onboardingStatus = 'COMPLETE';
    review.data.profile.onboardingStep = 'COMPLETE';
    review.data.publishedAt = '2026-10-07T08:45:30.000Z';

    expect(profileReviewResponseSchema.parse(review).data.publishedAt).toBe(
      '2026-10-07T08:45:30.000Z',
    );
  });
});
