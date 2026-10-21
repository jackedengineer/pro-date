import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  conversationInteractions,
  messageInteractionEvents,
  messageReactions,
  messageReplies,
} from '../src/schema.js';

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
describe('reaction persistence', () => {
  it('keeps actor tombstones and interaction revisions separate from text order', () => {
    const state = getTableConfig(messageReactions);
    expect(state.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      'message_id',
      'user_id',
    ]);
    expect(state.foreignKeys.some((key) => key.reference().columns.length === 2)).toBe(true);
    expect(state.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining(['message_reactions_kind_check', 'message_reactions_revision_check']),
    );
    const counter = getTableConfig(conversationInteractions);
    expect(counter.columns.map((column) => column.name)).toEqual(['conversation_id', 'revision']);
    const events = getTableConfig(messageInteractionEvents);
    expect(events.columns.map((column) => column.name)).not.toContain('body');
    expect(events.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      'conversation_id',
      'revision',
    ]);
  });
});
