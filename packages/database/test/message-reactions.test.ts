import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  buildInteractionChangesQuery,
  reactionNeedsWrite,
  writeReaction,
  type ChatTransaction,
} from '../src/message-interactions.js';
describe('desired-state reaction writes', () => {
  it('distinguishes actual changes, equivalent retries and versioned removals', () => {
    expect(reactionNeedsWrite(null, { reaction: 'HEART', expectedRevision: 0 })).toBe(true);
    expect(reactionNeedsWrite(null, { reaction: null, expectedRevision: 0 })).toBe(false);
    expect(
      reactionNeedsWrite(
        { reaction: 'HEART', revision: 1 },
        { reaction: 'HEART', expectedRevision: 0 },
      ),
    ).toBe(false);
    expect(
      reactionNeedsWrite(
        { reaction: 'HEART', revision: 1 },
        { reaction: null, expectedRevision: 1 },
      ),
    ).toBe(true);
    expect(
      reactionNeedsWrite({ reaction: null, revision: 2 }, { reaction: null, expectedRevision: 1 }),
    ).toBe(false);
    expect(() =>
      reactionNeedsWrite(
        { reaction: null, revision: 2 },
        { reaction: 'HEART', expectedRevision: 0 },
      ),
    ).toThrow('Refresh');
  });
  it('bounds durable replay using its own revision, never message sequence or offsets', () => {
    const query = new PgDialect().sqlToQuery(
      buildInteractionChangesQuery('10000000-0000-4000-8000-000000000001', {
        afterRevision: 12,
        limit: 50,
      }),
    );
    expect(query.sql).toContain('revision >');
    expect(query.sql).not.toContain('sequence');
    expect(query.sql).not.toContain('offset');
    expect(query.params).toContain(51);
    expect(query.params).toContain(12);
  });
});
describe('reaction transaction boundary', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  function setup(
    current: { reaction: 'HEART' | null; revision: number } | null = null,
    count = 0,
    missing = false,
  ) {
    const queries: { sql: string; params: unknown[] }[] = [];
    const execute = vi.fn((query: Parameters<PgDialect['sqlToQuery']>[0]) => {
      const compiled = new PgDialect().sqlToQuery(query);
      queries.push(compiled);
      const rows = compiled.sql.startsWith('select id from messages')
        ? missing
          ? []
          : [{ id }]
        : compiled.sql.startsWith('select kind')
          ? current === null
            ? []
            : [current]
          : compiled.sql.includes('count(*)')
            ? [{ count }]
            : compiled.sql.startsWith('insert into conversation_interactions')
              ? [{ revision: 7 }]
              : [];
      return Promise.resolve({ rows });
    });
    return { tx: { execute } as unknown as ChatTransaction, queries };
  }
  it('writes state and a durable event but no message, turn or notification', async () => {
    const { tx, queries } = setup();
    await writeReaction(tx, id, id, id, { reaction: 'HEART', expectedRevision: 0 });
    expect(queries.filter((query) => query.sql.startsWith('insert into'))).toHaveLength(3);
    expect(
      queries.some(
        (query) =>
          query.sql.includes('message_notification_jobs') ||
          query.sql.includes('last_message_sequence'),
      ),
    ).toBe(false);
    const write = queries.find((query) => query.sql.startsWith('insert into message_reactions'))!;
    expect(write.sql).not.toContain(id);
    expect(write.params).toEqual([id, id, id, 'HEART', 1, 7]);
  });
  it('does not spend quota or emit again for an exact desired-state retry', async () => {
    const { tx, queries } = setup({ reaction: 'HEART', revision: 1 });
    await writeReaction(tx, id, id, id, { reaction: 'HEART', expectedRevision: 0 });
    expect(queries).toHaveLength(2);
  });
  it('rejects missing private targets and actual changes above the independent quota', async () => {
    await expect(
      writeReaction(setup(null, 0, true).tx, id, id, id, {
        reaction: 'HEART',
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });
    const limited = setup(null, 60);
    await expect(
      writeReaction(limited.tx, id, id, id, { reaction: 'HEART', expectedRevision: 0 }),
    ).rejects.toMatchObject({ status: 429 });
    expect(limited.queries.some((query) => query.sql.startsWith('insert'))).toBe(false);
  });
});
