import type { ProfileReview } from '@pro-date/contracts';

/** A complete, published profile for tests. */
export const publishedReview: ProfileReview = {
  missingSections: [],
  photos: [0, 1, 2, 3].map((position) => ({
    deliveryUrl: `https://res.cloudinary.com/demo/image/upload/photo-${position}.jpg`,
    height: 1200,
    id: `00000000-0000-4000-8000-${(position + 1).toString().padStart(12, '0')}`,
    position,
    width: 960,
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
    isHeightVisible: false,
    locationLabel: 'Bengaluru, Karnataka',
    onboardingStatus: 'COMPLETE',
    onboardingStep: 'COMPLETE',
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
  publishedAt: '2026-11-01T10:00:00.000Z',
};
