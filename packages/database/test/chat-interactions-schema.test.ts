import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { messageReplies } from '../src/schema.js';

describe('reply persistence', () => {
  it('constrains both ends to the same conversation and forbids self references', () => {
    const table = getTableConfig(messageReplies);
    expect(table.foreignKeys).toHaveLength(2);
    for (const key of table.foreignKeys) {
      expect(key.reference().columns.map((column) => column.name)).toContain('conversation_id');
    }
    expect(table.checks.map((check) => check.name)).toContain('message_replies_no_self_check');
    expect(table.columns.find((column) => column.name === 'message_id')?.primary).toBe(true);
  });
});
