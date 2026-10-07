import type { ProfileReview } from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';
import { loadProfileReview, publishProfile } from './profile-publication';

const apiBaseUrl = 'https://api.prodate.example';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
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

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('profile publication API', () => {
  const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

  it('loads the authenticated profile review', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(response({ data: review, requestId }));

    await expect(loadProfileReview({ apiBaseUrl, fetchImplementation, getToken })).resolves.toEqual(
      review,
    );
    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile-review`, {
      headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
      method: 'GET',
    });
  });

  it('publishes through an idempotent authenticated request', async () => {
    const published = {
      ...review,
      profile: {
        ...review.profile,
        onboardingStatus: 'COMPLETE' as const,
        onboardingStep: 'COMPLETE' as const,
      },
      publishedAt: '2026-10-07T08:45:30.000Z',
    };
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(response({ data: published, requestId }));

    await expect(publishProfile({ apiBaseUrl, fetchImplementation, getToken })).resolves.toEqual(
      published,
    );
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${apiBaseUrl}/v1/users/me/profile-publication`,
      {
        headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
        method: 'PUT',
      },
    );
  });

  it('surfaces the safe API error when publication is incomplete', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      response(
        {
          error: {
            code: 'PROFILE_INCOMPLETE',
            message: 'Complete the missing profile sections before publishing.',
          },
          requestId,
        },
        409,
      ),
    );

    await expect(publishProfile({ apiBaseUrl, fetchImplementation, getToken })).rejects.toThrow(
      'Complete the missing profile sections before publishing.',
    );
  });
});
