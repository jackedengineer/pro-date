import { createServer } from 'node:http';
import { once } from 'node:events';
import type { MessagingRepository } from '@pro-date/database';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createMessagingRealtime } from '../src/messaging/messaging-realtime.js';

type Event = Awaited<ReturnType<MessagingRepository['claimEvents']>>[number];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function event(sequence: number): Event {
  return {
    messageId: `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    conversationId: '20000000-0000-4000-8000-000000000001',
    firstUserId: '30000000-0000-4000-8000-000000000001',
    secondUserId: '30000000-0000-4000-8000-000000000002',
    sequence,
  };
}
async function setup(queue: Event[]) {
  const completed: string[] = [];
  const repository = {
    claimEvents: () => Promise.resolve(queue.splice(0, 50)),
    canAccess: () => Promise.resolve(true),
    completeEvent: (id: string) => {
      completed.push(id);
      return Promise.resolve();
    },
  };
  const http = createServer();
  const realtime = createMessagingRealtime(http, {
    repository: repository as unknown as MessagingRepository,
    authenticate: () =>
      Promise.resolve({ userId: event(1).firstUserId, expiresAt: Date.now() + 60_000 }),
    logger: pino({ level: 'silent' }),
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  return { completed, repository, realtime };
}

describe('bounded realtime outbox draining', () => {
  it('drains a commit arriving during dispatch without waiting for the recovery timer', async () => {
    const queue = [event(1)];
    const { completed, repository, realtime } = await setup(queue);
    const entered = deferred();
    const release = deferred();
    repository.canAccess = async () => {
      entered.resolve();
      await release.promise;
      return true;
    };
    try {
      const first = realtime.flush();
      await entered.promise;
      queue.push(event(2));
      const second = realtime.flush();
      release.resolve();
      await Promise.all([first, second]);
      expect(completed).toEqual([event(1).messageId, event(2).messageId]);
      expect(queue).toEqual([]);
    } finally {
      release.resolve();
      await realtime.close();
    }
  });

  it('drains a multi-page committed backlog without waiting between claim pages', async () => {
    const queue = Array.from({ length: 125 }, (_, index) => event(index + 1));
    const expected = queue.map((row) => row.messageId);
    const { completed, realtime } = await setup(queue);
    try {
      await realtime.flush();
      expect(completed).toEqual(expected);
      expect(queue).toEqual([]);
    } finally {
      await realtime.close();
    }
  });

  it('remembers a commit arriving while an empty claim is in flight', async () => {
    const queue: Event[] = [];
    const { completed, repository, realtime } = await setup(queue);
    const entered = deferred();
    const release = deferred();
    let first = true;
    repository.claimEvents = async () => {
      const rows = queue.splice(0, 50);
      if (first) {
        first = false;
        entered.resolve();
        await release.promise;
      }
      return rows;
    };
    try {
      const pending = realtime.flush();
      await entered.promise;
      queue.push(event(1));
      const next = realtime.flush();
      release.resolve();
      await Promise.all([pending, next]);
      expect(completed).toEqual([event(1).messageId]);
    } finally {
      release.resolve();
      await realtime.close();
    }
  });

  it('coalesces concurrent flushes into one worker and acknowledges each event once', async () => {
    const queue = [event(1), event(2)];
    const { completed, repository, realtime } = await setup(queue);
    const entered = deferred();
    const release = deferred();
    let claimsInFlight = 0;
    let maximum = 0;
    repository.claimEvents = async () => {
      claimsInFlight++;
      maximum = Math.max(maximum, claimsInFlight);
      const rows = queue.splice(0, 50);
      entered.resolve();
      await release.promise;
      claimsInFlight--;
      return rows;
    };
    try {
      const pending = realtime.flush();
      await entered.promise;
      const concurrent = Array.from({ length: 20 }, () => realtime.flush());
      release.resolve();
      await Promise.all([pending, ...concurrent]);
      expect(maximum).toBe(1);
      expect(completed).toEqual([event(1).messageId, event(2).messageId]);
    } finally {
      release.resolve();
      await realtime.close();
    }
  });

  it('yields after a finite group of claim pages and continues a larger backlog', async () => {
    const queue = Array.from({ length: 450 }, (_, index) => event(index + 1));
    const expected = queue.map((row) => row.messageId);
    const { completed, realtime } = await setup(queue);
    try {
      // This callback was queued before any continuation, so it observes the yield.
      const yielded = new Promise<number>((resolve) =>
        setImmediate(() => resolve(completed.length)),
      );
      await realtime.flush();
      expect(completed).toHaveLength(200);
      expect(await yielded).toBe(200);
      await vi.waitFor(() => expect(completed).toEqual(expected));
    } finally {
      await realtime.close();
    }
  });

  it('stops claiming an empty queue instead of scheduling a hot loop', async () => {
    const { repository, realtime } = await setup([]);
    let claims = 0;
    repository.claimEvents = () => {
      claims++;
      return Promise.resolve([]);
    };
    try {
      await realtime.flush();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(claims).toBe(1);
    } finally {
      await realtime.close();
    }
  });

  it('defers failed claims without spinning and allows a later recovery flush', async () => {
    const queue = [event(1)];
    const { completed, repository, realtime } = await setup(queue);
    let claims = 0;
    repository.claimEvents = () => {
      claims++;
      return Promise.reject(new Error('Fixture repository unavailable'));
    };
    try {
      await realtime.flush();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(claims).toBe(1);
      expect(completed).toEqual([]);
      repository.claimEvents = () => Promise.resolve(queue.splice(0, 50));
      await realtime.flush();
      expect(completed).toEqual([event(1).messageId]);
    } finally {
      await realtime.close();
    }
  });

  it('does not publish or acknowledge after shutdown begins during authorization', async () => {
    const queue = [event(1)];
    const { completed, repository, realtime } = await setup(queue);
    const entered = deferred();
    const release = deferred();
    repository.canAccess = async () => {
      entered.resolve();
      await release.promise;
      return true;
    };
    try {
      const pending = realtime.flush();
      await entered.promise;
      const closing = realtime.close();
      release.resolve();
      await Promise.all([pending, closing]);
      expect(completed).toEqual([]);
    } finally {
      release.resolve();
      await realtime.close();
    }
  });

  it('cancels a scheduled continuation on shutdown', async () => {
    const queue = Array.from({ length: 250 }, (_, index) => event(index + 1));
    const { completed, realtime } = await setup(queue);
    try {
      await realtime.flush();
      await realtime.close();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await realtime.flush();
      expect(completed).toHaveLength(200);
      expect(queue).toHaveLength(50);
    } finally {
      await realtime.close();
    }
  });
});
