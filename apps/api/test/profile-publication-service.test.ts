import type { ProfileReview } from '@pro-date/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createProfilePublicationService } from '../src/profile/profile-publication-service.js';

const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const profile = {
  arePronounsVisible: true,
  birthDate: '1998-08-19',
  displayName: 'Avery',
  genderIdentity: 'Non-binary',
  hasLocation: true,
  heightCm: 173,
  interestedIn: ['WOMEN'] as ('WOMEN' | 'MEN' | 'NON_BINARY_PEOPLE')[],
  isGenderVisible: true,
  isHeightVisible: true,
  locationLabel: 'Bengaluru, Karnataka',
  onboardingStatus: 'IN_PROGRESS' as const,
  onboardingStep: 'REVIEW' as const,
  pronouns: 'they/them',
  relationshipIntent: 'LONG_TERM' as const,
};
const photos = Array.from({ length: 4 }, (_, position) => ({
  deliveryUrl: `https://res.cloudinary.com/pro-date-dev/image/upload/profile-${position}.jpg`,
  height: 1600,
  id: `00000000-0000-4000-8000-${(position + 1).toString().padStart(12, '0')}`,
  position,
  width: 1200,
}));
const prompts = [
  {
    answer: 'I build tiny tools that make creative work feel lighter.',
    id: '10000000-0000-4000-8000-000000000001',
    position: 0,
    promptId: 'weekend_build' as const,
  },
  {
    answer: 'Coffee, a long walk, and one wildly specific playlist.',
    id: '10000000-0000-4000-8000-000000000002',
    position: 1,
    promptId: 'debug_bad_day' as const,
  },
  {
    answer: 'Curious questions, kind reviews, and excellent snack choices.',
    id: '10000000-0000-4000-8000-000000000003',
    position: 2,
    promptId: 'merge_criteria' as const,
  },
];

describe('profile publication service', () => {
  it('assembles a review from canonical profile, photo, and prompt records', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue({ profile, publishedAt: null }),
      publish: vi.fn(),
    };
    const service = createProfilePublicationService(
      repository,
      { list: vi.fn().mockResolvedValue(photos) },
      { list: vi.fn().mockResolvedValue(prompts) },
    );

    const review = await service.get(userId);

    expect(review).toEqual({
      missingSections: [],
      photos,
      profile,
      prompts,
      publishedAt: null,
    } satisfies ProfileReview);
  });

  it('returns the canonical completed profile after an idempotent publish', async () => {
    const completedProfile = {
      ...profile,
      onboardingStatus: 'COMPLETE' as const,
      onboardingStep: 'COMPLETE' as const,
    };
    const repository = {
      find: vi.fn(),
      publish: vi.fn().mockResolvedValue({
        profile: completedProfile,
        publishedAt: new Date('2026-10-07T08:45:30.000Z'),
      }),
    };
    const service = createProfilePublicationService(
      repository,
      { list: vi.fn().mockResolvedValue(photos) },
      { list: vi.fn().mockResolvedValue(prompts) },
    );

    const review = await service.publish(userId);

    expect(review.profile).toEqual(completedProfile);
    expect(review.publishedAt).toBe('2026-10-07T08:45:30.000Z');
    expect(repository.publish).toHaveBeenCalledWith(userId);
  });
});
