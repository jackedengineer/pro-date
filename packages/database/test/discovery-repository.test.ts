import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { buildDiscoveryQuery, buildPublicProfilesQuery } from '../src/discovery-repository.js';
import * as schema from '../src/schema.js';

const database = drizzle.mock({ schema });
const viewer = '729438da-99b3-4d3d-b566-bfe94401829b';
const dialect = new PgDialect();

describe('discovery queries', () => {
  it('filters geographically with parameterized limits, reciprocal preferences and safety exclusions', () => {
    const query = dialect.sqlToQuery(
      buildDiscoveryQuery(
        viewer,
        { limit: 10, radiusKm: 50, minAge: 18, maxAge: 99 },
        { ceiling: '2026-10-08T12:00:00.000Z' },
      ),
    );
    expect(query.sql).toContain('ST_DWithin');
    expect(query.sql).toContain('user_blocks');
    expect(query.sql).toContain('profile_passes');
    expect(query.sql).toContain('pull_requests');
    expect(query.sql).not.toContain(viewer);
    expect(query.params).toContain(50000);
    expect(query.params).toContain(11);
  });
  it('uses a stable keyset without discarding PostgreSQL timestamp precision', () => {
    const query = dialect.sqlToQuery(
      buildDiscoveryQuery(
        viewer,
        { limit: 10, radiusKm: 50, minAge: 18, maxAge: 99 },
        { ceiling: '2026-10-08T12:00:00.000Z', at: '2026-10-07T12:00:00.123456Z', id: viewer },
      ),
    );
    expect(query.sql).toContain('(p.published_at, p.user_id) <');
    expect(query.params).toContain('2026-10-07T12:00:00.123456Z');
    expect(query.sql).not.toContain('offset');
  });
  it('projects age and permitted public details without disclosing private coordinates or birthdays', () => {
    const query = dialect.sqlToQuery(buildPublicProfilesQuery(viewer, [viewer]));
    const selection = query.sql.split('from profiles p')[0];
    expect(selection).toContain('case when p.is_gender_visible');
    expect(selection).toContain('case when p.are_pronouns_visible');
    expect(selection).toContain('case when p.is_height_visible');
    expect(selection).not.toContain('p.location as');
    expect(selection).not.toContain('p.birth_date as');
    expect(database).toBeDefined();
  });
});
