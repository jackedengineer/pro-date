import { createServer } from 'node:http';
import { once } from 'node:events';
import pino from 'pino';
import { io, type Socket } from 'socket.io-client';
import { describe, expect, it, vi } from 'vitest';
import type { MessagingRepository } from '@pro-date/database';
import { createMessagingRealtime } from '../src/messaging/messaging-realtime.js';

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const conversationId = '10000000-0000-4000-8000-000000000003';
function socketEvent(socket: Socket, event: string) {
  return new Promise<unknown[]>((resolve) =>
    socket.once(event, (...args: unknown[]) => resolve(args)),
  );
}
describe('authenticated realtime hints', () => {
  it('rejects expired socket sessions', async () => {
    const http = createServer();
    const repository = {
      claimEvents: vi.fn().mockResolvedValue([]),
    } as unknown as MessagingRepository;
    const realtime = createMessagingRealtime(http, {
      repository,
      logger: pino({ level: 'silent' }),
      authenticate: () => Promise.resolve({ userId: first, expiresAt: Date.now() - 1 }),
    });
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const address = http.address();
    if (address === null || typeof address === 'string') throw new Error('Missing address');
    const client = io(`http://127.0.0.1:${address.port}`, {
      transports: ['websocket'],
      auth: { token: first },
      reconnection: false,
    });
    try {
      await socketEvent(client, 'connect_error');
      expect(client.connected).toBe(false);
    } finally {
      client.disconnect();
      await realtime.close();
    }
  });
  it('delivers privacy-minimized hints only to authenticated members and suppresses a blocked event', async () => {
    const http = createServer();
    const repository = {
      claimEvents: vi.fn().mockResolvedValue([]),
      canAccess: vi.fn().mockResolvedValue(true),
      completeEvent: vi.fn(),
    } as unknown as MessagingRepository;
    const realtime = createMessagingRealtime(http, {
      repository,
      logger: pino({ level: 'silent' }),
      authenticate: (token) => {
        if (token !== first && token !== second) throw new Error('Invalid test credential.');
        return Promise.resolve({ userId: token, expiresAt: Date.now() + 60_000 });
      },
    });
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const address = http.address();
    if (address === null || typeof address === 'string') throw new Error('Missing local address.');
    const url = `http://127.0.0.1:${address.port}`;
    const one = io(url, { transports: ['websocket'], auth: { token: first }, reconnection: false });
    const two = io(url, {
      transports: ['websocket'],
      auth: { token: second },
      reconnection: false,
    });
    const stranger = io(url, {
      transports: ['websocket'],
      auth: { token: 'invalid' },
      reconnection: false,
    });
    try {
      await Promise.all([
        socketEvent(one, 'connect'),
        socketEvent(two, 'connect'),
        socketEvent(stranger, 'connect_error'),
      ]);
      expect(stranger.connected).toBe(false);
      const event = {
        messageId: conversationId,
        conversationId,
        sequence: 1,
        firstUserId: first,
        secondUserId: second,
      };
      vi.mocked(repository.claimEvents).mockResolvedValueOnce([event]);
      const incoming = Promise.all([
        socketEvent(one, 'conversation:changed'),
        socketEvent(two, 'conversation:changed'),
      ]);
      await realtime.flush();
      const payloads = await incoming;
      expect(payloads.map(([payload]) => payload)).toEqual([
        { conversationId, sequence: 1 },
        { conversationId, sequence: 1 },
      ]);
      const listener = vi.fn();
      two.on('conversation:changed', listener);
      vi.mocked(repository.claimEvents).mockResolvedValueOnce([{ ...event, sequence: 2 }]);
      vi.mocked(repository.canAccess).mockResolvedValue(false);
      await realtime.flush();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(listener).not.toHaveBeenCalled();
      expect(repository.completeEvent).toHaveBeenCalledWith(conversationId);
    } finally {
      one.disconnect();
      two.disconnect();
      stranger.disconnect();
      await realtime.close();
    }
  });
});
