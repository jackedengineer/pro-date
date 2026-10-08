import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  notificationSettings,
  conversationNotificationPreferences,
  notificationDevices,
  messageNotificationJobs,
  notificationAttempts,
} from '../src/schema.js';

describe('normalized notification persistence', () => {
  it('defaults all chats off and account pause off, with revisions for invalidating queued work', () => {
    expect(conversationNotificationPreferences.isEnabled.default).toBe(false);
    expect(notificationSettings.isPaused.default).toBe(false);
    expect(
      getTableConfig(conversationNotificationPreferences).primaryKeys[0]?.columns.map(
        (c) => c.name,
      ),
    ).toEqual(['conversation_id', 'user_id']);
    expect(notificationSettings.revision.notNull).toBe(true);
  });
  it('guards active token uniqueness, device versions and durable message-device deduplication', () => {
    expect(
      getTableConfig(notificationDevices).indexes.some(
        (i) => i.config.name === 'notification_devices_active_token_unique' && i.config.unique,
      ),
    ).toBe(true);
    expect(
      getTableConfig(messageNotificationJobs).uniqueConstraints.some(
        (c) => c.name === 'notification_jobs_message_device_unique',
      ),
    ).toBe(true);
    expect(
      getTableConfig(notificationAttempts).uniqueConstraints.some(
        (c) => c.name === 'notification_attempts_job_number_unique',
      ),
    ).toBe(true);
    expect(notificationDevices.secretHash.getSQLType()).toBe('varchar(64)');
    expect(notificationDevices.generation.notNull).toBe(true);
  });
  it('does not snapshot tokens or private text into delivery jobs/attempts and uses no JSONB', () => {
    for (const table of [
      notificationSettings,
      conversationNotificationPreferences,
      notificationDevices,
      messageNotificationJobs,
      notificationAttempts,
    ])
      expect(getTableConfig(table).columns.map((c) => c.getSQLType())).not.toContain('jsonb');
    for (const table of [messageNotificationJobs, notificationAttempts]) {
      const names = getTableConfig(table).columns.map((c) => c.name);
      for (const forbidden of ['body', 'token', 'sender_name', 'email', 'phone', 'location'])
        expect(names).not.toContain(forbidden);
    }
  });
});
