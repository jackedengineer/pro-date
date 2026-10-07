import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';

import {
  buildProfileCompletionQuery,
  buildProfilePublicationQuery,
  findMissingProfileSections,
} from '../src/profile-publication-repository.js';
import * as schema from '../src/schema.js';

const userId = '729438da-99b3-4d3d-b566-bfe94401829b';

const completeProfile = {
  arePronounsVisible: true,
  birthDate: '1998-08-19',
  displayName: 'Avery',
  genderIdentity: 'Non-binary',
  hasLocation: true,
  heightCm: 173,
  interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'] as ('WOMEN' | 'NON_BINARY_PEOPLE')[],
  isGenderVisible: true,
  isHeightVisible: true,
  locationLabel: 'Bengaluru, Karnataka',
  onboardingStatus: 'IN_PROGRESS' as const,
  onboardingStep: 'REVIEW' as const,
  pronouns: 'they/them',
  relationshipIntent: 'LONG_TERM' as const,
};

describe('profile publication repository', () => {
  it('finds no gaps for a complete, ordered profile', () => {
    expect(findMissingProfileSections(completeProfile, [0, 1, 2, 3], [0, 1, 2])).toEqual([]);
  });

  it('reports each incomplete publication section without leaking field values', () => {
    expect(
      findMissingProfileSections(
        { ...completeProfile, displayName: null, hasLocation: false },
        [0, 2, 3, 4],
        [0, 2],
      ),
    ).toEqual(['BASICS', 'PHOTOS', 'PROMPTS']);
  });

  it('publishes once while preserving the first publication timestamp', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildProfilePublicationQuery(database, userId).toSQL();

    expect(sql).toContain('update "profiles"');
    expect(sql).toContain('coalesce("profiles"."published_at", now())');
    expect(sql).toContain('returning "published_at"');
    expect(params).toEqual([userId]);
  });

  it('marks onboarding complete as part of publication', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildProfileCompletionQuery(database, userId).toSQL();

    expect(sql).toContain('update "users"');
    expect(sql).toContain('"onboarding_status" = $1');
    expect(sql).toContain('"onboarding_step" = $2');
    expect(params).toEqual(['COMPLETE', 'COMPLETE', userId]);
  });
});
