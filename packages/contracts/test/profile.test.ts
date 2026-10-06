import { describe, expect, it } from 'vitest';

import { isAtLeastAge, profileResponseSchema, updateProfileRequestSchema } from '../src/profile.js';

const emptyProfileDraft = {
  arePronounsVisible: true,
  birthDate: null,
  displayName: null,
  genderIdentity: null,
  hasLocation: false,
  heightCm: null,
  interestedIn: [],
  isGenderVisible: true,
  isHeightVisible: true,
  locationLabel: null,
  onboardingStatus: 'IN_PROGRESS' as const,
  onboardingStep: 'IDENTITY' as const,
  pronouns: null,
  relationshipIntent: null,
};

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

  it('accepts an inclusive identity and visibility update', () => {
    expect(
      updateProfileRequestSchema.parse({
        identity: {
          arePronounsVisible: true,
          genderIdentity: '  Non-binary  ',
          isGenderVisible: false,
          pronouns: '  they/them  ',
        },
      }),
    ).toEqual({
      identity: {
        arePronounsVisible: true,
        genderIdentity: 'Non-binary',
        isGenderVisible: false,
        pronouns: 'they/them',
      },
    });
  });

  it('accepts unique dating audiences and a supported relationship intent', () => {
    expect(
      updateProfileRequestSchema.parse({
        preferences: {
          interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
          relationshipIntent: 'LONG_TERM',
        },
      }),
    ).toEqual({
      preferences: {
        interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
        relationshipIntent: 'LONG_TERM',
      },
    });

    expect(
      updateProfileRequestSchema.safeParse({
        preferences: {
          interestedIn: ['WOMEN', 'WOMEN'],
          relationshipIntent: 'LONG_TERM',
        },
      }).success,
    ).toBe(false);
  });

  it('accepts a bounded coarse-location update and rejects leaked detail fields', () => {
    expect(
      updateProfileRequestSchema.parse({
        location: {
          countryCode: 'IN',
          latitude: 19.076,
          locality: 'Mumbai',
          longitude: 72.8777,
          region: 'Maharashtra',
        },
      }),
    ).toEqual({
      location: {
        countryCode: 'IN',
        latitude: 19.076,
        locality: 'Mumbai',
        longitude: 72.8777,
        region: 'Maharashtra',
      },
    });

    expect(
      updateProfileRequestSchema.safeParse({
        location: {
          countryCode: 'IN',
          latitude: 91,
          locality: 'Mumbai',
          longitude: 72.8777,
          postalCode: '400001',
          region: 'Maharashtra',
        },
      }).success,
    ).toBe(false);
  });

  it('accepts a canonical height and visibility update', () => {
    expect(
      updateProfileRequestSchema.parse({ height: { centimeters: 173, isVisible: true } }),
    ).toEqual({ height: { centimeters: 173, isVisible: true } });
    expect(
      updateProfileRequestSchema.safeParse({ height: { centimeters: 119, isVisible: true } })
        .success,
    ).toBe(false);
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
        ...emptyProfileDraft,
        displayName: 'Ada',
        onboardingStep: 'BIRTHDAY' as const,
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    } as const;

    expect(profileResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects provider identifiers in the public response', () => {
    expect(
      profileResponseSchema.safeParse({
        data: {
          ...emptyProfileDraft,
          clerkSubject: 'user_private_provider_identifier',
          displayName: 'Ada',
          onboardingStep: 'BIRTHDAY',
        },
        requestId: 'a537e843-0100-489f-9719-fc2123a53810',
      }).success,
    ).toBe(false);
  });

  it('accepts the saved birthday checkpoint as a complete profile draft', () => {
    const response = {
      data: {
        ...emptyProfileDraft,
        birthDate: '2000-02-29',
        displayName: 'Ada',
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    } as const;

    expect(profileResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts a complete basic-profile draft without exposing coordinates', () => {
    const response = {
      data: {
        arePronounsVisible: true,
        birthDate: '2000-02-29',
        displayName: 'Ada',
        genderIdentity: 'Non-binary',
        hasLocation: true,
        heightCm: 173,
        interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
        isGenderVisible: false,
        isHeightVisible: true,
        locationLabel: 'Mumbai, Maharashtra',
        onboardingStatus: 'IN_PROGRESS',
        onboardingStep: 'PHOTOS',
        pronouns: 'they/them',
        relationshipIntent: 'LONG_TERM',
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    } as const;

    expect(profileResponseSchema.parse(response)).toEqual(response);
    expect(JSON.stringify(response)).not.toContain('latitude');
    expect(JSON.stringify(response)).not.toContain('longitude');
  });
});
