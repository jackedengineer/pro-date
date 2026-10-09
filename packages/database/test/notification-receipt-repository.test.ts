import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { ProDateDatabase } from '../src/client.js';
import { createNotificationReceiptRepository } from '../src/notification-receipt-repository.js';

function setup() {
  const dialect = new PgDialect();
  const queries: ReturnType<PgDialect['sqlToQuery']>[] = [];
  const execute = vi.fn((query: Parameters<PgDialect['sqlToQuery']>[0]) => {
    queries.push(dialect.sqlToQuery(query));
    return Promise.resolve({ rows: [] });
  });
  const database = { execute } as unknown as ProDateDatabase;
  return { queries, repository: createNotificationReceiptRepository(database) };
}
describe('receipt SQL boundaries (no live PostgreSQL)', () => {
  it('leases only bounded, due, unexpired accepted receipts', async () => {
    const test = setup();
    await test.repository.claim();
    expect(test.queries[0]?.sql).toContain('limit 4 for update skip locked');
    expect(test.queries[0]?.sql).toContain("receipt_status = 'PENDING'");
    expect(test.queries[0]?.sql).toContain('receipt_expires_at >');
    // Database time prevents worker clock skew; millisecond precision survives the JS Date CAS round trip.
    expect(test.queries[0]?.sql).toContain("date_trunc('milliseconds', clock_timestamp())");
  });
  it('fences completion by the exact receipt lease, without modifying send eligibility', async () => {
    const test = setup();
    await test.repository.finish(
      {
        attemptId: 'attempt',
        ticketId: 'ticket',
        deviceId: 'device',
        deviceGeneration: 1,
        leaseUntil: new Date(61000),
        expiresAt: new Date(100000),
      },
      'PENDING',
      null,
    );
    expect(test.queries[0]?.sql).toContain('receipt_due_at =');
    expect(test.queries[0]?.params).toContainEqual(new Date(61000));
    expect(test.queries[0]?.sql).not.toContain('update message_notification_jobs');
  });
  it('expires unresolved receipts in bounded batches rather than resending messages', async () => {
    const test = setup();
    await test.repository.expire();
    expect(test.queries[0]?.sql).toContain('limit 100 for update skip locked');
    expect(test.queries[0]?.sql).toContain("receipt_status = 'EXPIRED'");
    expect(test.queries[0]?.sql).not.toContain('insert');
  });
});
