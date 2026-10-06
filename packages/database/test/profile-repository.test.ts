import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';

import {
  buildBirthDateUpsertQuery,
  buildHeightUpsertQuery,
  buildIdentityUpsertQuery,
  buildLocationUpsertQuery,
  buildOnboardingProgressQuery,
  buildPreferencesUpsertQuery,
  buildProfileUpsertQuery,
} from '../src/profile-repository.js';
import * as schema from '../src/schema.js';

const userId = '729438da-99b3-4d3d-b566-bfe94401829b';

describe('profile repository', () => {
  it('builds an idempotent display-name upsert keyed by internal user ID', () => {
    const database = drizzle.mock({ schema });

    const { params, sql } = buildProfileUpsertQuery(database, userId, 'Ada').toSQL();

    expect(sql).toContain('insert into "profiles"');
    expect(sql).toContain('on conflict ("user_id") do update');
    expect(sql).toContain('returning');
    expect(sql).toContain('"birth_date"');
    expect(sql).toContain('"display_name"');
    expect(params).toEqual([userId, 'Ada', 'Ada']);
    expect(sql).not.toContain('clerk_subject');
  });

  it('advances the user to the next resumable onboarding checkpoint', () => {
    const database = drizzle.mock({ schema });

    const { params, sql } = buildOnboardingProgressQuery(database, userId, 'BIRTHDAY').toSQL();

    expect(sql).toContain('update "users"');
    expect(sql).toContain('greatest("users"."onboarding_status", $1::onboarding_status)');
    expect(sql).toContain('greatest("users"."onboarding_step", $2::onboarding_step)');
    expect(sql).toContain('returning "onboarding_status", "onboarding_step"');
    expect(params).toEqual(['IN_PROGRESS', 'BIRTHDAY', userId]);
  });

  it('builds an idempotent calendar-date upsert keyed by internal user ID', () => {
    const database = drizzle.mock({ schema });

    const { params, sql } = buildBirthDateUpsertQuery(database, userId, '2000-02-29').toSQL();

    expect(sql).toContain('insert into "profiles"');
    expect(sql).toContain('on conflict ("user_id") do update');
    expect(sql).toContain('returning');
    expect(sql).toContain('"birth_date"');
    expect(sql).toContain('"display_name"');
    expect(params).toEqual([userId, '2000-02-29', '2000-02-29']);
    expect(sql).not.toContain('clerk_subject');
  });

  it('advances a saved birthday to the identity checkpoint', () => {
    const database = drizzle.mock({ schema });

    const { params } = buildOnboardingProgressQuery(database, userId, 'IDENTITY').toSQL();

    expect(params).toEqual(['IN_PROGRESS', 'IDENTITY', userId]);
  });

  it('builds an idempotent identity upsert with visibility controls', () => {
    const database = drizzle.mock({ schema });
    const query = buildIdentityUpsertQuery(database, userId, {
      arePronounsVisible: true,
      genderIdentity: 'Non-binary',
      isGenderVisible: false,
      pronouns: 'they/them',
    });
    const { params, sql } = query.toSQL();

    expect(sql).toContain('on conflict ("user_id") do update');
    expect(sql).not.toContain('clerk_subject');
    expect(params).toEqual([
      userId,
      'Non-binary',
      'they/them',
      false,
      true,
      'Non-binary',
      'they/them',
      false,
      true,
    ]);
  });

  it('builds an idempotent dating-preferences upsert', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildPreferencesUpsertQuery(database, userId, {
      interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
      relationshipIntent: 'LONG_TERM',
    }).toSQL();

    expect(sql).toContain('on conflict ("user_id") do update');
    expect(params).toContain('LONG_TERM');
    expect(params).toContain('{"WOMEN","NON_BINARY_PEOPLE"}');
  });

  it('stores exact coordinates as a parameterized PostGIS geography without returning them', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildLocationUpsertQuery(database, userId, {
      countryCode: 'IN',
      latitude: 19.076,
      locality: 'Mumbai',
      longitude: 72.8777,
      region: 'Maharashtra',
    }).toSQL();

    expect(sql).toContain('ST_SetSRID(ST_MakePoint(');
    expect(sql).toContain('::geography');
    expect(sql).not.toContain('returning "location"');
    expect(params).toContain(72.8777);
    expect(params).toContain(19.076);
  });

  it('builds an idempotent canonical-height upsert', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildHeightUpsertQuery(database, userId, {
      centimeters: 173,
      isVisible: true,
    }).toSQL();

    expect(sql).toContain('on conflict ("user_id") do update');
    expect(params).toEqual([userId, 173, true, 173, true]);
  });

  it.each([
    ['identity', 'PREFERENCES'],
    ['preferences', 'LOCATION'],
    ['location', 'DETAILS'],
    ['height', 'PHOTOS'],
  ] as const)('advances %s to the %s checkpoint', (_, nextStep) => {
    const database = drizzle.mock({ schema });
    const { params } = buildOnboardingProgressQuery(database, userId, nextStep).toSQL();

    expect(params).toEqual(['IN_PROGRESS', nextStep, userId]);
  });
});
