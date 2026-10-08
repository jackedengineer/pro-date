import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { ConversationChanged } from '@pro-date/contracts';
import type { MessagingRepository } from '@pro-date/database';
import type { Logger } from 'pino';
import { Server } from 'socket.io';

interface Options {
  repository: MessagingRepository;
  authenticate: (token: string) => Promise<{ userId: string; expiresAt: number }>;
  logger: Logger;
}
export function createMessagingRealtime(http: HttpServer, options: Options) {
  // Native clients only, matching the REST API's existing browser-origin policy.
  const io = new Server<
    Record<string, never>,
    { 'conversation:changed': (payload: ConversationChanged) => void },
    Record<string, never>,
    { userId: string; expiresAt: number }
  >(http, {
    transports: ['websocket'],
    maxHttpBufferSize: 16_384,
    allowRequest: (request, done) => done(null, request.headers.origin === undefined),
  });
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string' || token.length === 0 || token.length > 8192) {
      next(new Error('Authentication is required.'));
      return;
    }
    void Promise.resolve()
      .then(() => options.authenticate(token))
      .then((auth) => {
        if (auth.expiresAt <= Date.now()) throw new Error('Expired session.');
        socket.data.userId = auth.userId;
        socket.data.expiresAt = auth.expiresAt;
        next();
      })
      .catch(() => next(new Error('Please sign in again.')));
  });
  io.on('connection', (socket) => {
    // Clients cannot choose or join arbitrary rooms. Each verified account gets its own room.
    void socket.join(`user:${socket.data.userId}`);
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.min(2_147_483_647, socket.data.expiresAt - Date.now()),
    );
    expiry.unref();
    socket.on('disconnect', () => clearTimeout(expiry));
  });
  let stopped = false;
  let pending: Promise<void> | null = null;
  async function dispatch() {
    const events = await options.repository.claimEvents();
    for (const event of events) {
      if (stopped) return;
      // Do not publish a queued hint once the pair is blocked or unmatched.
      if (await options.repository.canAccess(event.firstUserId, event.conversationId)) {
        io.to([`user:${event.firstUserId}`, `user:${event.secondUserId}`]).emit(
          'conversation:changed',
          {
            conversationId: event.conversationId,
            sequence: event.sequence,
          },
        );
      }
      await options.repository.completeEvent(event.messageId);
    }
  }
  function flush(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (pending !== null) return pending;
    pending = dispatch()
      .catch((failure: unknown) => {
        options.logger.warn(
          {
            event: 'messaging_outbox_deferred',
            dispatchId: randomUUID(),
            errorType: failure instanceof Error ? failure.name : 'UnknownError',
          },
          'Realtime dispatch deferred; REST recovery remains authoritative',
        );
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }
  // A leased record is retried after a crash. Socket.IO is a hint channel, not durable storage.
  // Source: https://socket.io/docs/v4/delivery-guarantees/
  const timer = setInterval(() => void flush(), 1500);
  timer.unref();
  return {
    flush,
    async close() {
      stopped = true;
      clearInterval(timer);
      await pending;
      await new Promise<void>((resolve) => {
        void io.close(() => resolve());
      });
    },
  };
}
