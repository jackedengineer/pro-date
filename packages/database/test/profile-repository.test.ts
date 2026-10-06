import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';

import {
  buildBirthDateUpsertQuery,
  buildOnboardingProgressQuery,
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
    expect(sql).toContain('returning "birth_date", "display_name"');
    expect(params).toEqual([userId, 'Ada', 'Ada']);
    expect(sql).not.toContain('clerk_subject');
  });

  it('advances the user to the next resumable onboarding checkpoint', () => {
    const database = drizzle.mock({ schema });

    const { params, sql } = buildOnboardingProgressQuery(database, userId, 'BIRTHDAY').toSQL();

    expect(sql).toContain('update "users"');
    expect(sql).toContain('"onboarding_status" = $1');
    expect(sql).toContain('"onboarding_step" = $2');
    expect(sql).toContain('returning "onboarding_status", "onboarding_step"');
    expect(params).toEqual(['IN_PROGRESS', 'BIRTHDAY', userId]);
  });

  it('builds an idempotent calendar-date upsert keyed by internal user ID', () => {
    const database = drizzle.mock({ schema });

    const { params, sql } = buildBirthDateUpsertQuery(database, userId, '2000-02-29').toSQL();

    expect(sql).toContain('insert into "profiles"');
    expect(sql).toContain('on conflict ("user_id") do update');
    expect(sql).toContain('returning "birth_date", "display_name"');
    expect(params).toEqual([userId, '2000-02-29', '2000-02-29']);
    expect(sql).not.toContain('clerk_subject');
  });

  it('advances a saved birthday to the identity checkpoint', () => {
    const database = drizzle.mock({ schema });

    const { params } = buildOnboardingProgressQuery(database, userId, 'IDENTITY').toSQL();

    expect(params).toEqual(['IN_PROGRESS', 'IDENTITY', userId]);
  });
});
