import { describe, expect, it } from 'vitest';
import { messageHistoryQuerySchema, sendMessageSchema } from '../src/messaging.js';

const clientId = '10000000-0000-4000-8000-000000000001';
describe('messaging boundaries', () => {
  it('trims text without accepting empty, oversized, or forged sender input', () => {
    expect(sendMessageSchema.parse({ clientId, body: '  Hello, fellow builder.  ' })).toEqual({
      clientId,
      body: 'Hello, fellow builder.',
    });
    for (const body of ['', '   ', 'x'.repeat(2001)])
      expect(sendMessageSchema.safeParse({ clientId, body }).success).toBe(false);
    expect(
      sendMessageSchema.safeParse({ clientId, body: 'Hello', senderId: clientId }).success,
    ).toBe(false);
  });
  it('requires one stable intent UUID and bounds history queries', () => {
    expect(sendMessageSchema.safeParse({ body: 'Hello' }).success).toBe(false);
    expect(messageHistoryQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(messageHistoryQuerySchema.parse({ afterSequence: '10' }).afterSequence).toBe(10);
    for (const value of [{ limit: 51 }, { afterSequence: -1 }, { cursor: 'a', afterSequence: 0 }])
      expect(messageHistoryQuerySchema.safeParse(value).success).toBe(false);
  });
});
