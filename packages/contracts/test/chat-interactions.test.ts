import { describe, expect, it } from 'vitest';
import {
  chatCapabilitiesSchema,
  messageContextQuerySchema,
  messageContextSchema,
  sendMessageSchema,
  setMessageReactionSchema,
} from '../src/messaging.js';

const id = '10000000-0000-4000-8000-000000000001';
describe('bounded chat extensions', () => {
  it('accepts a reply identifier but never client-authored quoted text or actors', () => {
    expect(sendMessageSchema.parse({ clientId: id, body: 'hello', replyToMessageId: id })).toEqual({
      clientId: id,
      body: 'hello',
      replyToMessageId: id,
    });
    expect(
      sendMessageSchema.safeParse({ clientId: id, body: 'hello', replyTo: { excerpt: 'forged' } })
        .success,
    ).toBe(false);
  });
  it('bounds and deduplicates explicit context batches', () => {
    expect(messageContextQuerySchema.parse({ ids: id }).ids).toEqual([id]);
    for (const ids of ['', `${id},${id}`, Array(51).fill(id).join(','), 'not-an-id'])
      expect(messageContextQuerySchema.safeParse({ ids }).success).toBe(false);
  });
  it('requires a curated desired reaction and a nonnegative expected version', () => {
    expect(setMessageReactionSchema.parse({ reaction: 'HEART', expectedRevision: 0 })).toEqual({
      reaction: 'HEART',
      expectedRevision: 0,
    });
    expect(
      setMessageReactionSchema.safeParse({ reaction: null, expectedRevision: 1 }).success,
    ).toBe(true);
    for (const value of [
      { reaction: 'custom', expectedRevision: 0 },
      { reaction: 'HEART', expectedRevision: -1 },
      { reaction: 'HEART', expectedRevision: 0, userId: id },
    ])
      expect(setMessageReactionSchema.safeParse(value).success).toBe(false);
  });
  it('keeps context explicit and bounded, separate from a message sequence', () => {
    expect(chatCapabilitiesSchema.parse({ replies: false, reactions: false })).toEqual({
      replies: false,
      reactions: false,
    });
    expect(
      messageContextSchema.parse({ messageId: id, revision: 0, replyTo: null, reactions: [] }),
    ).toEqual({ messageId: id, revision: 0, replyTo: null, reactions: [] });
    expect(
      messageContextSchema.safeParse({
        messageId: id,
        revision: 0,
        replyTo: null,
        reactions: [],
        sequence: 10,
      }).success,
    ).toBe(false);
  });
});
