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
  function setup(replay = false, replyToMessageId?: string, missingTarget = false) {
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
      return Promise.resolve({
        rows: text.includes('count(*)')
          ? [{ count: 0 }]
          : text.includes('message_replies')
            ? [{ replyToMessageId }]
            : missingTarget && text.includes('select id from messages')
              ? []
              : [{}],
      });
    });
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn(() =>
        table === messages ? { returning: () => Promise.resolve([message]) } : Promise.resolve(),
      ),
    }));
    const tx = {
      select,
      execute,
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      insert,
    };
    const transaction = vi.fn((run: (value: typeof tx) => Promise<unknown>) => run(tx));
    const database = { transaction } as unknown as ProDateDatabase;
    return { database, transaction, queries, insert, input: { clientId: viewer, body: 'hello' } };
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
  it('rejects a reply before touching unprepared tables when disabled', async () => {
    const test = setup();
    await expect(
      createMessagingRepository(test.database).send(viewer, conversation, {
        ...test.input,
        replyToMessageId: conversation,
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(test.queries.some((query) => query.includes('message_replies'))).toBe(false);
  });
  it('never reads reaction state or its outbox when the feature is disabled', async () => {
    const test = setup();
    const repository = createMessagingRepository(test.database);
    expect(await repository.claimInteractionEvents()).toEqual([]);
    await expect(
      repository.setReaction(viewer, conversation, viewer, {
        reaction: 'HEART',
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      test.queries.some(
        (query) =>
          query.includes('message_reactions') || query.includes('message_interaction_events'),
      ),
    ).toBe(false);
  });
  it('rejects reuse of a saved intent with a different reply target', async () => {
    const test = setup(true, conversation);
    await expect(
      createMessagingRepository(test.database, {
        notificationsEnabled: false,
        expoProjectId: null,
        repliesEnabled: true,
      }).send(viewer, conversation, test.input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('returns an identical reply replay without new writes or quota checks', async () => {
    const test = setup(true, viewer);
    await createMessagingRepository(test.database, {
      notificationsEnabled: false,
      expoProjectId: null,
      repliesEnabled: true,
    }).send(viewer, conversation, { ...test.input, replyToMessageId: viewer });
    expect(test.insert).not.toHaveBeenCalled();
    expect(test.queries.some((query) => query.includes('count(*)'))).toBe(false);
  });
  it('rejects a target outside this conversation before inserting a message', async () => {
    const test = setup(false, undefined, true);
    await expect(
      createMessagingRepository(test.database, {
        notificationsEnabled: false,
        expoProjectId: null,
        repliesEnabled: true,
      }).send(viewer, conversation, { ...test.input, replyToMessageId: viewer }),
    ).rejects.toMatchObject({ status: 422 });
    expect(test.insert).not.toHaveBeenCalled();
    expect(test.queries.some((query) => query.includes('conversation_id ='))).toBe(true);
  });
});
