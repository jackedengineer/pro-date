import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { ConversationChanged, RealtimeAdmissionError } from '@pro-date/contracts';
import type { MessagingRepository } from '@pro-date/database';
import type { Logger } from 'pino';
import { Server } from 'socket.io';
import { RealtimeAdmission, type AdmissionLimits } from './realtime-admission.js';

interface Options {
  repository: MessagingRepository;
  authenticate: (token: string) => Promise<{ userId: string; expiresAt: number }>;
  logger: Logger;
  admissionLimits?: Partial<AdmissionLimits>;
  authTimeoutMs?: number;
}
export function createMessagingRealtime(http: HttpServer, options: Options) {
  const admission = new RealtimeAdmission(options.admissionLimits);
  let stopped = false;
  const pendingAdmissions = new Set<() => void>();
  const rejected: Partial<Record<RealtimeAdmissionError['code'], number>> = {};
  function admissionError(data: RealtimeAdmissionError) {
    rejected[data.code] = (rejected[data.code] ?? 0) + 1;
    return Object.assign(new Error('Messaging connection unavailable.'), { data });
  }
  // Native clients only, matching the REST API's existing browser-origin policy.
  const io = new Server<
    Record<string, never>,
    { 'conversation:changed': (payload: ConversationChanged) => void },
    Record<string, never>,
    { userId: string; expiresAt: number }
  >(http, {
    transports: ['websocket'],
    maxHttpBufferSize: 16_384,
    connectTimeout: 10_000,
    allowRequest: (request, done) => {
      if (stopped || request.headers.origin !== undefined) {
        done('Unavailable', false);
        return;
      }
      done(null, true);
    },
  });
  io.use((socket, next) => {
    const peerFailure = admission.admitPeer(socket.conn.remoteAddress ?? 'unknown');
    if (stopped || peerFailure !== null) {
      next(admissionError(peerFailure ?? { code: 'SERVER_BUSY', retryAfterMs: 5000 }));
      return;
    }
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string' || token.length === 0 || token.length > 8192) {
      next(admissionError({ code: 'AUTH_REQUIRED' }));
      return;
    }
    const releaseVerification = admission.reserveVerification();
    if (releaseVerification === null) {
      next(admissionError({ code: 'SERVER_BUSY', retryAfterMs: 5000 }));
      return;
    }
    let finished = false;
    let releaseSocket: (() => void) | null = null;
    const cleanup = () => {
      finished = true;
      clearTimeout(deadline);
      releaseSocket?.();
      socket.conn.off('close', cleanup);
      pendingAdmissions.delete(cleanup);
    };
    const reject = (data: RealtimeAdmissionError) => {
      if (finished) return;
      cleanup();
      next(admissionError(data));
    };
    const deadline = setTimeout(
      () => reject({ code: 'AUTH_TIMEOUT', retryAfterMs: 1000 }),
      options.authTimeoutMs ?? 5000,
    );
    deadline.unref();
    pendingAdmissions.add(cleanup);
    // Middleware rejection/transport close does not emit a Socket disconnect.
    socket.conn.once('close', cleanup);
    void Promise.resolve()
      .then(() => options.authenticate(token))
      .then((auth) => {
        if (finished || stopped) return;
        if (!Number.isFinite(auth.expiresAt) || auth.expiresAt <= Date.now()) {
          reject({ code: 'AUTH_REQUIRED' });
          return;
        }
        releaseSocket = admission.reserveSocket(auth.userId);
        if (releaseSocket === null) {
          reject({ code: 'SERVER_BUSY', retryAfterMs: 5000 });
          return;
        }
        finished = true;
        clearTimeout(deadline);
        pendingAdmissions.delete(cleanup);
        socket.once('disconnect', cleanup);
        socket.data.userId = auth.userId;
        socket.data.expiresAt = auth.expiresAt;
        next();
      })
      .catch(() => reject({ code: 'AUTH_REQUIRED' }))
      // A deadline can't cancel arbitrary credential verification. Keep it counted until settlement.
      .finally(releaseVerification);
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
  const telemetry = setInterval(() => {
    if (Object.keys(rejected).length === 0 && admission.snapshot().verifications === 0) return;
    options.logger.info(
      { event: 'messaging_admission', rejected: { ...rejected }, ...admission.snapshot() },
      'Realtime admission budgets',
    );
    for (const key of Object.keys(rejected) as RealtimeAdmissionError['code'][])
      delete rejected[key];
  }, 30_000);
  telemetry.unref();
  return {
    flush,
    admissionSnapshot: () => admission.snapshot(),
    async close() {
      stopped = true;
      clearInterval(timer);
      clearInterval(telemetry);
      for (const cancel of pendingAdmissions) cancel();
      await pending;
      await new Promise<void>((resolve) => {
        void io.close(() => resolve());
      });
    },
  };
}
