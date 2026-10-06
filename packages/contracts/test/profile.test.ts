import { describe, expect, it } from 'vitest';

import { isAtLeastAge, profileResponseSchema, updateProfileRequestSchema } from '../src/profile.js';

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

  it('accepts a calendar-only birthday and rejects impossible or timestamp values', () => {
    expect(updateProfileRequestSchema.parse({ birthDate: '2000-02-29' })).toEqual({
      birthDate: '2000-02-29',
    });
    expect(updateProfileRequestSchema.safeParse({ birthDate: '2001-02-29' }).success).toBe(false);
    expect(
      updateProfileRequestSchema.safeParse({ birthDate: '2000-02-29T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('accepts exactly one profile checkpoint field per update', () => {
    expect(
      updateProfileRequestSchema.safeParse({ birthDate: '2000-02-29', displayName: 'Ada' }).success,
    ).toBe(false);
    expect(updateProfileRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('isAtLeastAge', () => {
  it('changes eligibility on the exact calendar birthday', () => {
    expect(isAtLeastAge('2008-10-07', '2026-10-06', 18)).toBe(false);
    expect(isAtLeastAge('2008-10-06', '2026-10-06', 18)).toBe(true);
  });

  it('never treats a future birthday as eligible', () => {
    expect(isAtLeastAge('2027-01-01', '2026-10-06', 18)).toBe(false);
  });
});

describe('profileResponseSchema', () => {
  it('accepts the saved display-name checkpoint', () => {
    const response = {
      data: {
        birthDate: null,
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
          birthDate: null,
          clerkSubject: 'user_private_provider_identifier',
          displayName: 'Ada',
          onboardingStatus: 'IN_PROGRESS',
          onboardingStep: 'BIRTHDAY',
        },
        requestId: 'a537e843-0100-489f-9719-fc2123a53810',
      }).success,
    ).toBe(false);
  });

  it('accepts the saved birthday checkpoint as a complete profile draft', () => {
    const response = {
      data: {
        birthDate: '2000-02-29',
        displayName: 'Ada',
        onboardingStatus: 'IN_PROGRESS',
        onboardingStep: 'IDENTITY',
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    } as const;

    expect(profileResponseSchema.parse(response)).toEqual(response);
  });
});
