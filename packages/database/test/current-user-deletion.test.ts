import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { buildCurrentUserDeleteQuery } from '../src/current-user-repository.js';
import * as schema from '../src/schema.js';

describe('account deletion', () => {
  it('deletes exactly one member, identified by their verified sign-in subject', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildCurrentUserDeleteQuery(database, 'user_subject').toSQL();

    expect(sql).toContain('delete from "users"');
    expect(sql).toContain('where "users"."clerk_subject" = $1');
    expect(sql).toContain('returning "id"');
    expect(params).toEqual(['user_subject']);
  });

  it('leaves nothing behind: every reference to a member cascades on delete', () => {
    const tables = Object.values(schema).filter(
      (value): value is typeof schema.users =>
        typeof value === 'object' &&
        value !== null &&
        Symbol.for('drizzle:IsDrizzleTable') in value,
    );
    const toUsers = tables.flatMap((table) =>
      getTableConfig(table).foreignKeys.filter(
        (key) => getTableConfig(key.reference().foreignTable).name === 'users',
      ),
    );

    // A new table that points at users without a cascade would silently survive deletion.
    expect(toUsers.length).toBeGreaterThan(10);
    expect(toUsers.filter((key) => key.onDelete !== 'cascade')).toEqual([]);
  });
});
