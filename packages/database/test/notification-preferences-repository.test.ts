import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  buildNotificationSettingsUpdate,
  buildConversationNotificationUpdate,
  buildCancelNotificationJobs,
  createNotificationPreferencesRepository,
} from '../src/notification-preferences-repository.js';
import type { ProDateDatabase } from '../src/client.js';
const owner = '10000000-0000-4000-8000-000000000001';
const conversation = '10000000-0000-4000-8000-000000000002';
const dialect = new PgDialect();
describe('notification preference persistence', () => {
  it('does not create a row or advance a revision for the absent unpaused default', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const lock = {
      from: () => lock,
      where: () => lock,
      orderBy: () => lock,
      for: vi.fn().mockResolvedValue([]),
    };
    const tx = { execute, select: () => lock };
    const database = {
      execute,
      transaction: (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    } as unknown as ProDateDatabase;
    const repository = createNotificationPreferencesRepository(database);
    await expect(repository.saveSettings(owner, false)).resolves.toEqual({
      isPaused: false,
      revision: 0,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(lock.for).toHaveBeenCalledWith('update');
  });
  it('persists a pause and cancels pending jobs in the same transaction callback', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ isPaused: true, revision: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    const lock = {
      from: () => lock,
      where: () => lock,
      orderBy: () => lock,
      for: vi.fn().mockResolvedValue([]),
    };
    const tx = { execute, select: () => lock };
    const transaction = vi.fn((operation: (transaction: typeof tx) => Promise<unknown>) =>
      operation(tx),
    );
    const repository = createNotificationPreferencesRepository({
      transaction,
    } as unknown as ProDateDatabase);
    await expect(repository.saveSettings(owner, true)).resolves.toEqual({
      isPaused: true,
      revision: 1,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(3);
  });
  it('upserts desired states without bumping revisions on equivalent retries', () => {
    for (const query of [
      buildNotificationSettingsUpdate(owner, true),
      buildConversationNotificationUpdate(owner, conversation, false),
    ]) {
      const compiled = dialect.sqlToQuery(query);
      expect(compiled.sql).toContain('on conflict');
      expect(compiled.sql).toContain('is distinct from');
      expect(compiled.sql).not.toContain(owner);
      expect(compiled.params).toContain(owner);
    }
  });
  it('cancels only unsubmitted work for the authenticated recipient and optional chat', () => {
    const compiled = dialect.sqlToQuery(buildCancelNotificationJobs(owner, conversation));
    expect(compiled.sql).toContain("status in ('PENDING', 'LEASED')");
    expect(compiled.sql).toContain('recipient_id');
    expect(compiled.sql).toContain('conversation_id');
    expect(compiled.params).toContain(owner);
    expect(compiled.params).toContain(conversation);
    expect(compiled.sql).toContain('claim_id = null');
    expect(compiled.sql).not.toContain('notification_attempts');
  });
});
