import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  createMessagingRepository,
  buildConversationAccessQuery,
  buildMessageHistoryQuery,
} from '../src/messaging-repository.js';
import type { ProDateDatabase } from '../src/client.js';
import { messages } from '../src/schema.js';

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

describe('first-commit notification intents', () => {
  function setup(replay = false) {
    const message = {
      id: conversation,
      conversationId: conversation,
      senderId: viewer,
      clientId: viewer,
      sequence: 1,
      body: 'hello',
      createdAt: new Date(),
    };
    const match = {
      id: conversation,
      firstUserId: viewer,
      secondUserId: '10000000-0000-4000-8000-000000000003',
      lastMessageSequence: 0,
      unmatchedAt: null,
    };
    const selected = [[match], [{ id: viewer }], [match], replay ? [message] : []];
    const select = () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(selected.shift()),
        for: () => Promise.resolve(selected.shift()),
      };
      return chain;
    };
    const queries: string[] = [];
    const execute = vi.fn((query: Parameters<PgDialect['sqlToQuery']>[0]) => {
      const text = dialect.sqlToQuery(query).sql;
      queries.push(text);
      return Promise.resolve({ rows: text.includes('count(*)') ? [{ count: 0 }] : [{}] });
    });
    const tx = {
      select,
      execute,
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      insert: (table: unknown) => ({
        values: () =>
          table === messages ? { returning: () => Promise.resolve([message]) } : Promise.resolve(),
      }),
    };
    const transaction = vi.fn((run: (value: typeof tx) => Promise<unknown>) => run(tx));
    const database = { transaction } as unknown as ProDateDatabase;
    return { database, transaction, queries, input: { clientId: viewer, body: 'hello' } };
  }
  it('adds recipient intents inside the message transaction, not after committing it', async () => {
    const test = setup();
    await createMessagingRepository(test.database, {
      notificationsEnabled: true,
      expoProjectId: viewer,
    }).send(viewer, conversation, test.input);
    expect(
      test.queries.filter((query) => query.includes('insert into message_notification_jobs')),
    ).toHaveLength(1);
    expect(test.transaction).toHaveBeenCalledTimes(1);
  });
  it('does not replay notifications on a sender/clientId retry', async () => {
    const test = setup(true);
    await createMessagingRepository(test.database, {
      notificationsEnabled: true,
      expoProjectId: viewer,
    }).send(viewer, conversation, test.input);
    expect(test.queries.some((query) => query.includes('message_notification_jobs'))).toBe(false);
  });
  it('never touches notification tables when the migration feature is off', async () => {
    const test = setup();
    await createMessagingRepository(test.database).send(viewer, conversation, test.input);
    expect(test.queries.some((query) => query.includes('message_notification_jobs'))).toBe(false);
  });
});
