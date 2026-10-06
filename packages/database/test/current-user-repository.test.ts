import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';

import { buildCurrentUserUpsertQuery } from '../src/current-user-repository.js';
import * as schema from '../src/schema.js';

describe('current-user repository', () => {
  it('builds one idempotent upsert keyed only by the Clerk subject', () => {
    const database = drizzle.mock({ schema });

    const query = buildCurrentUserUpsertQuery(database, 'user_clerk_subject');
    const { params, sql } = query.toSQL();

    expect(sql).toContain('insert into "users"');
    expect(sql).toContain('on conflict ("clerk_subject") do update');
    expect(sql).toContain('returning "id", "onboarding_status", "onboarding_step"');
    expect(params).toEqual(['user_clerk_subject', 'user_clerk_subject']);
    expect(sql).not.toContain('email');
    expect(sql).not.toContain('phone');
  });
});
