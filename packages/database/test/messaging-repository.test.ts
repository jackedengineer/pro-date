import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  buildConversationAccessQuery,
  buildMessageHistoryQuery,
} from '../src/messaging-repository.js';

const viewer = '10000000-0000-4000-8000-000000000001';
const conversation = '10000000-0000-4000-8000-000000000002';
const dialect = new PgDialect();
describe('messaging persistence boundaries', () => {
  it('requires membership and excludes blocks/unmatches without relying on discovery eligibility', () => {
    const query = dialect.sqlToQuery(buildConversationAccessQuery(viewer, conversation));
    expect(query.sql).toContain('user_blocks');
    expect(query.sql).toContain('unmatched_at is null');
    expect(query.sql).toContain('first_user_id');
    expect(query.sql).not.toContain(viewer);
    expect(query.params).toContain(viewer);
    expect(query.params).toContain(conversation);
    expect(query.sql).not.toContain('profile_photos');
  });
  it('uses a bounded sequence keyset for ascending reconnect deltas', () => {
    const query = dialect.sqlToQuery(
      buildMessageHistoryQuery(conversation, { limit: 50, afterSequence: 20 }),
    );
    expect(query.sql).toContain('sequence >');
    expect(query.sql).toContain('sequence asc');
    expect(query.params).toContain(20);
    expect(query.params).toContain(51);
    expect(query.sql).not.toContain('offset');
  });
});
