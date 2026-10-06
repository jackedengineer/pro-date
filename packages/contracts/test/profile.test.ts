import { describe, expect, it } from 'vitest';

import { profileResponseSchema, updateProfileRequestSchema } from '../src/profile.js';

describe('updateProfileRequestSchema', () => {
  it('trims and accepts a display name between 2 and 40 characters', () => {
    expect(updateProfileRequestSchema.parse({ displayName: '  Ada  ' })).toEqual({
      displayName: 'Ada',
    });
  });

  it.each(['', 'A', 'A'.repeat(41)])('rejects the invalid display name %j', (displayName) => {
    expect(updateProfileRequestSchema.safeParse({ displayName }).success).toBe(false);
  });

  it('rejects control characters without excluding international names', () => {
    expect(updateProfileRequestSchema.safeParse({ displayName: 'Ada\nAdmin' }).success).toBe(false);
    expect(updateProfileRequestSchema.parse({ displayName: '李 小龙' })).toEqual({
      displayName: '李 小龙',
    });
  });

  it('rejects fields that are not part of the profile contract', () => {
    expect(
      updateProfileRequestSchema.safeParse({
        clerkSubject: 'user_private_provider_identifier',
        displayName: 'Ada',
      }).success,
    ).toBe(false);
  });
});

describe('profileResponseSchema', () => {
  it('accepts the saved display-name checkpoint', () => {
    const response = {
      data: {
        displayName: 'Ada',
        onboardingStatus: 'IN_PROGRESS',
        onboardingStep: 'BIRTHDAY',
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    } as const;

    expect(profileResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects provider identifiers in the public response', () => {
    expect(
      profileResponseSchema.safeParse({
        data: {
          clerkSubject: 'user_private_provider_identifier',
          displayName: 'Ada',
          onboardingStatus: 'IN_PROGRESS',
          onboardingStep: 'BIRTHDAY',
        },
        requestId: 'a537e843-0100-489f-9719-fc2123a53810',
      }).success,
    ).toBe(false);
  });
});
