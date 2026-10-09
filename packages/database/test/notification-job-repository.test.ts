import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  buildEnqueueNotifications,
  buildNotificationEligibility,
  createNotificationJobRepository,
} from '../src/notification-job-repository.js';
import type { ProDateDatabase } from '../src/client.js';
import type { NotificationAttempt } from '../src/notification-job-repository.js';

const message = '10000000-0000-4000-8000-000000000001';
const recipient = '10000000-0000-4000-8000-000000000002';
const project = '10000000-0000-4000-8000-000000000003';
const dialect = new PgDialect();
const attempt: NotificationAttempt = {
  jobId: message,
  claimId: recipient,
  attemptId: project,
  attemptNumber: 2,
  deviceId: recipient,
  deviceGeneration: 3,
  token: 'private-token',
  expiresAt: new Date(86400000),
  createdAt: new Date(0),
  payload: {
    version: 1,
    type: 'CHAT_MESSAGE',
    conversationId: project,
    messageId: message,
    recipientId: recipient,
  },
};
function fake(rows: unknown[][] = []) {
  const queries: ReturnType<PgDialect['sqlToQuery']>[] = [];
  const execute = vi.fn((query: Parameters<PgDialect['sqlToQuery']>[0]) => {
    queries.push(dialect.sqlToQuery(query));
    return Promise.resolve({ rows: rows.shift() ?? [] });
  });
  const database = {
    execute,
    transaction: (run: (tx: { execute: typeof execute }) => unknown) => run({ execute }),
  } as unknown as ProDateDatabase;
  return { database, queries };
}
describe('notification queue boundaries (no live PostgreSQL)', () => {
  it('persists a new attempt only after claim ownership and final eligibility, without a token snapshot', async () => {
    const test = fake([
      [{ id: message }],
      [
        {
          ...attempt,
          attemptNumber: 1,
          conversationId: project,
          messageId: message,
          recipientId: recipient,
        },
      ],
      [],
      [],
      [{ id: project }],
    ]);
    const prepared = await createNotificationJobRepository(test.database, project).prepare({
      id: message,
      claimId: recipient,
    });
    expect(prepared).toMatchObject({
      attemptNumber: 2,
      attemptId: project,
      payload: attempt.payload,
    });
    const insert = test.queries.find((query) =>
      query.sql.includes('insert into notification_attempts'),
    )!;
    expect(insert.params).not.toContain(attempt.token);
    expect(insert.params).toContain(2);
  });
  it('cancels an owned but ineligible job without an external attempt', async () => {
    const test = fake([[{ id: message }], [], []]);
    expect(
      await createNotificationJobRepository(test.database, project).prepare({
        id: message,
        claimId: recipient,
      }),
    ).toBeNull();
    expect(test.queries.at(-1)?.sql).toContain("status = 'CANCELLED'");
    expect(
      test.queries.some((query) => query.sql.includes('insert into notification_attempts')),
    ).toBe(false);
  });
  it('records late accepted receipts but fences job completion by claim and attempt number', async () => {
    const test = fake();
    await createNotificationJobRepository(test.database, project).finish(attempt, {
      outcome: 'ACCEPTED',
      errorCode: null,
      ticketId: 'ticket',
      nextAttemptAt: new Date(0),
    });
    const record = test.queries.find((query) =>
      query.sql.includes('update notification_attempts'),
    )!;
    const job = test.queries.find((query) =>
      query.sql.includes('update message_notification_jobs'),
    )!;
    expect(record.sql).toContain("outcome in ('STARTED', 'UNKNOWN') and ticket_id is null");
    expect(record.params).toContain('PENDING');
    expect(job.sql).toContain('claim_id =');
    expect(job.sql).toContain('attempt_count =');
    expect(job.sql).toContain('leased_until >');
    expect(job.params).toContain(attempt.claimId);
    expect(job.params).toContain(attempt.attemptNumber);
  });
  it('enqueues only current opted-in recipient devices, with revision snapshots and durable deduplication', () => {
    const query = dialect.sqlToQuery(buildEnqueueNotifications(message, recipient, project));
    expect(query.sql).not.toContain(recipient);
    expect(query.params).toContain(recipient);
    expect(query.params).toContain(project);
    for (const text of [
      'is_enabled',
      'is_paused',
      'revoked_at is null',
      'expires_at >',
      'on conflict',
      'device_generation',
      'preference_revision',
      'settings_revision',
    ])
      expect(query.sql).toContain(text);
    expect(query.sql).not.toContain('message_outbox');
  });
  it('rechecks membership, block/unmatch, project and all eligibility generations', () => {
    const query = dialect.sqlToQuery(buildNotificationEligibility(message, recipient, project));
    for (const text of [
      'user_blocks',
      'unmatched_at is null',
      'device_generation',
      'settings_revision',
      'preference_revision',
      'owner_id',
      'project_id',
      'onboarding_status',
      'leased_until >',
    ])
      expect(query.sql).toContain(text);
    expect(query.sql).not.toContain('body');
    expect(query.sql).not.toContain(message);
  });
  it('claims bounded due batches and fences with a new lease per job', async () => {
    const test = fake();
    await createNotificationJobRepository(test.database, project).claim();
    const text = test.queries.map((query) => query.sql).join('\n');
    expect(text).toContain('skip locked');
    expect(text).toContain('gen_random_uuid()');
    expect(text).toContain("status = 'PENDING'");
    expect(text).toContain('leased_until <=');
    expect(text).toContain('limit 4');
  });
  it('cannot start an external attempt after losing the claim', async () => {
    const test = fake([[]]);
    expect(
      await createNotificationJobRepository(test.database, project).prepare({
        id: message,
        claimId: recipient,
      }),
    ).toBeNull();
    expect(
      test.queries.some((query) => query.sql.includes('insert into notification_attempts')),
    ).toBe(false);
  });
  it('keeps housekeeping bounded and preserves unresolved accepted receipts', async () => {
    const test = fake();
    await createNotificationJobRepository(test.database, project).housekeep();
    const text = test.queries.map((query) => query.sql).join('\n');
    expect(text).toContain("interval '7 days'");
    expect(text).toContain("receipt_status = 'PENDING'");
    expect(text).toContain('limit 100');
    expect(text).not.toContain('delete from messages');
    expect(text).toContain('token = null');
    expect(text).toContain("outcome = 'UNKNOWN'");
    expect(text).toContain("a.outcome = 'STARTED'");
  });
  it('retires only the device generation that actually failed, never its replacement', async () => {
    const test = fake();
    await createNotificationJobRepository(test.database, project).retire(message, 7);
    const query = test.queries[0]!;
    expect(query.sql).toContain('generation =');
    expect(query.params).toContain(7);
    expect(query.sql).toContain('token = null');
  });
});
