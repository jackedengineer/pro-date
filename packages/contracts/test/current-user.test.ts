import { describe, expect, it } from 'vitest';

import { currentUserResponseSchema } from '../src/current-user.js';

const baseResponse = {
  data: {
    id: '91f16792-62c5-4b98-8292-10763e72db7d',
    onboardingStatus: 'NOT_STARTED',
  },
  requestId: 'a537e843-0100-489f-9719-fc2123a53810',
} as const;

describe('currentUserResponseSchema', () => {
  it.each(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'] as const)(
    'accepts the %s onboarding status',
    (onboardingStatus) => {
      const response = {
        ...baseResponse,
        data: { ...baseResponse.data, onboardingStatus },
      };

      expect(currentUserResponseSchema.parse(response)).toEqual(response);
    },
  );

  it('rejects provider identifiers outside the public user contract', () => {
    const response = {
      ...baseResponse,
      data: {
        ...baseResponse.data,
        clerkSubject: 'user_provider_identifier',
      },
    };

    expect(currentUserResponseSchema.safeParse(response).success).toBe(false);
  });

  it.each([
    { field: 'id', value: 'not-a-uuid' },
    { field: 'onboardingStatus', value: 'UNKNOWN' },
  ])('rejects an invalid user $field', ({ field, value }) => {
    const response = {
      ...baseResponse,
      data: {
        ...baseResponse.data,
        [field]: value,
      },
    };

    expect(currentUserResponseSchema.safeParse(response).success).toBe(false);
  });
});
