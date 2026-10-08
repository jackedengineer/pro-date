import type { DiscoveryProfile } from '@pro-date/contracts';

export const discoveryFixture: DiscoveryProfile = {
  userId: '10000000-0000-4000-8000-000000000001',
  displayName: 'Avery',
  age: 28,
  locationLabel: 'Bengaluru, Karnataka',
  genderIdentity: null,
  pronouns: 'they/them',
  heightCm: null,
  relationshipIntent: 'LONG_TERM',
  photos: Array.from({ length: 4 }, (_, position) => ({
    id: `00000000-0000-4000-8000-${(position + 1).toString().padStart(12, '0')}`,
    position,
    width: 1200,
    height: 1600,
    deliveryUrl: `https://res.cloudinary.com/demo/image/upload/fixture-${position}.jpg`,
  })),
  prompts: ['weekend_build', 'debug_bad_day', 'merge_criteria'].map((promptId, position) => ({
    id: `10000000-0000-4000-8000-${(position + 2).toString().padStart(12, '0')}`,
    promptId: promptId as DiscoveryProfile['prompts'][number]['promptId'],
    position,
    answer: 'I enjoy making thoughtful products with kind people.',
  })),
};
