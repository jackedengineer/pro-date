import { describe, expect, it } from 'vitest';

import {
  conversationsResponseSchema,
  discoveryResponseSchema,
  messageHistoryResponseSchema,
  messageResponseSchema,
  sendMessageSchema,
  updateProfileRequestSchema,
} from '../src/index';

const id = '10000000-0000-4000-8000-000000000001';
const message = {
  id,
  conversationId: id,
  senderId: id,
  clientId: id,
  sequence: 1,
  body: 'Hello',
  createdAt: '2026-11-10T10:00:00.000Z',
};

// Installed app versions cannot be force-updated. An additive server change must not turn
// a committed send into a client-side "failed" message, or break history sync.
describe('forward-compatible responses', () => {
  it('accepts a newer server that adds fields, and drops them', () => {
    const parsed = messageResponseSchema.parse({
      data: { ...message, editedAt: null, deliveryState: 'DELIVERED' },
      requestId: id,
      serverVersion: '2.0.0',
    });
    expect(parsed).toEqual({ data: message, requestId: id });

    expect(
      messageHistoryResponseSchema.parse({
        data: [{ ...message, editedAt: null }],
        olderCursor: null,
        nextAfterSequence: null,
        latestSequence: 1,
        requestId: id,
        typing: false,
      }).data,
    ).toEqual([message]);

    expect(
      conversationsResponseSchema.parse({
        data: [
          {
            id,
            member: { userId: id, displayName: 'Ada', photoUrl: null, isVerified: true },
            createdAt: message.createdAt,
            activityAt: message.createdAt,
            lastMessage: { ...message, editedAt: null },
            unreadCount: 3,
          },
        ],
        nextCursor: null,
        requestId: id,
      }).data[0],
    ).not.toHaveProperty('unreadCount');

    expect(
      discoveryResponseSchema.parse({ data: [], nextCursor: null, requestId: id, rankingId: 'x' }),
    ).toEqual({ data: [], nextCursor: null, requestId: id });
  });

  it('still rejects unknown request fields at the API boundary', () => {
    expect(sendMessageSchema.safeParse({ clientId: id, body: 'Hi', senderId: id }).success).toBe(
      false,
    );
    expect(
      updateProfileRequestSchema.safeParse({ displayName: 'Ada', isAdmin: true }).success,
    ).toBe(false);
  });
});
