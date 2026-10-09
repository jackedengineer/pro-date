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
  it('releases reservations when transport closes during middleware and never admits late credentials', async () => {
    const http = createServer();
    let settle: (value: { userId: string; expiresAt: number }) => void = () => {};
    const realtime = createMessagingRealtime(http, {
      repository: { claimEvents: vi.fn().mockResolvedValue([]) } as unknown as MessagingRepository,
      logger: pino({ level: 'silent' }),
      authenticate: () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
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
      await vi.waitFor(() => expect(realtime.admissionSnapshot().verifications).toBe(1));
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(realtime.admissionSnapshot().verifications).toBe(1);
      settle({ userId: first, expiresAt: Date.now() + 60_000 });
      await vi.waitFor(() => expect(realtime.admissionSnapshot().verifications).toBe(0));
      expect(realtime.admissionSnapshot().sockets).toBe(0);
    } finally {
      client.disconnect();
      await realtime.close();
    }
  });
  it('times out slow authentication without releasing unresolved verification or accepting late success', async () => {
    const http = createServer();
    let settle: (value: { userId: string; expiresAt: number }) => void = () => {};
    const authenticate = vi.fn(
      () =>
        new Promise<{ userId: string; expiresAt: number }>((resolve) => {
          settle = resolve;
        }),
    );
    const realtime = createMessagingRealtime(http, {
      repository: { claimEvents: vi.fn().mockResolvedValue([]) } as unknown as MessagingRepository,
      logger: pino({ level: 'silent' }),
      authenticate,
      authTimeoutMs: 30,
      admissionLimits: { maxVerifications: 1 },
    });
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const address = http.address();
    if (address === null || typeof address === 'string') throw new Error('Missing address');
    const url = `http://127.0.0.1:${address.port}`;
    const one = io(url, { transports: ['websocket'], auth: { token: first }, reconnection: false });
    let two: Socket | undefined;
    try {
      const [failure] = await socketEvent(one, 'connect_error');
      expect(failure).toMatchObject({ data: { code: 'AUTH_TIMEOUT' } });
      two = io(url, { transports: ['websocket'], auth: { token: first }, reconnection: false });
      expect((await socketEvent(two, 'connect_error'))[0]).toMatchObject({
        data: { code: 'SERVER_BUSY' },
      });
      expect(authenticate).toHaveBeenCalledTimes(1);
      settle({ userId: first, expiresAt: Date.now() + 60_000 });
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(one.connected).toBe(false);
      expect(realtime.admissionSnapshot().verifications).toBe(0);
      expect(realtime.admissionSnapshot().sockets).toBe(0);
    } finally {
      one.disconnect();
      two?.disconnect();
      await realtime.close();
    }
  });
  it('releases account reservations on disconnect and rejects excess sockets', async () => {
    const http = createServer();
    const realtime = createMessagingRealtime(http, {
      repository: { claimEvents: vi.fn().mockResolvedValue([]) } as unknown as MessagingRepository,
      logger: pino({ level: 'silent' }),
      authenticate: () => Promise.resolve({ userId: first, expiresAt: Date.now() + 60_000 }),
      admissionLimits: { maxAccountSockets: 1 },
    });
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const address = http.address();
    if (address === null || typeof address === 'string') throw new Error('Missing address');
    const url = `http://127.0.0.1:${address.port}`;
    const clients: Socket[] = [];
    const connect = () => {
      const client = io(url, {
        transports: ['websocket'],
        auth: { token: first },
        reconnection: false,
      });
      clients.push(client);
      return client;
    };
    try {
      const one = connect();
      await socketEvent(one, 'connect');
      const two = connect();
      expect((await socketEvent(two, 'connect_error'))[0]).toMatchObject({
        data: { code: 'SERVER_BUSY' },
      });
      one.disconnect();
      await vi.waitFor(() => expect(realtime.admissionSnapshot().sockets).toBe(0));
      const three = connect();
      await socketEvent(three, 'connect');
      expect(three.connected).toBe(true);
    } finally {
      for (const client of clients) client.disconnect();
      await realtime.close();
    }
    expect(realtime.admissionSnapshot().sockets).toBe(0);
  });
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
