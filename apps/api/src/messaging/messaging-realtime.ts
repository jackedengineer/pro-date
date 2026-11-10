import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  REALTIME_AUTH_REFRESH_EVENT,
  type ConversationChanged,
  type RealtimeAdmissionError,
  type RealtimeAuthRefreshAck,
} from '@pro-date/contracts';
import type { MessagingRepository } from '@pro-date/database';
import type { Logger } from 'pino';
import { Server } from 'socket.io';
import { describeError } from '../logger.js';
import { RealtimeAdmission, type AdmissionLimits } from './realtime-admission.js';

interface Options {
  interactionsEnabled?: boolean;
  repository: MessagingRepository;
  authenticate: (token: string) => Promise<{ userId: string; expiresAt: number }>;
  logger: Logger;
  admissionLimits?: Partial<AdmissionLimits>;
  authTimeoutMs?: number;
  /** Header set by a trusted gateway with the real client IP; null uses the TCP peer. */
  trustedClientIpHeader?: string | null;
  /** Shortest gap between two session refreshes on one socket. */
  refreshIntervalMs?: number;
}

// Behind a proxy every socket shares the proxy's TCP address, which would turn per-peer
// admission budgets into one global budget. Only a gateway that overwrites the header may
// supply it; a bounded, IP-shaped value is required or the TCP peer is used.
export function admissionPeer(
  remoteAddress: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  trustedHeader: string | null | undefined,
): string {
  const forwarded = trustedHeader ? headers[trustedHeader] : undefined;
  if (typeof forwarded === 'string' && /^[0-9a-fA-F:.]{2,45}$/.test(forwarded)) return forwarded;
  return remoteAddress ?? 'unknown';
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
    // Client input is untrusted: the handler validates both the token and the ack callback.
    { [REALTIME_AUTH_REFRESH_EVENT]: (token: unknown, ack: unknown) => void },
    {
      'conversation:changed': (payload: ConversationChanged) => void;
      'conversation:interactions-changed': (payload: {
        conversationId: string;
        revision: number;
      }) => void;
    },
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
    const peerFailure = admission.admitPeer(
      admissionPeer(
        socket.conn.remoteAddress,
        socket.handshake.headers,
        options.trustedClientIpHeader,
      ),
    );
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
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const scheduleExpiry = () => {
      clearTimeout(expiry);
      expiry = setTimeout(
        () => socket.disconnect(true),
        Math.max(0, Math.min(2_147_483_647, socket.data.expiresAt - Date.now())),
      );
      expiry.unref();
    };
    scheduleExpiry();
    let refreshing = false;
    let lastRefreshAt = Number.NEGATIVE_INFINITY;
    socket.on(REALTIME_AUTH_REFRESH_EVENT, (token, ack) => {
      if (typeof ack !== 'function') return;
      const reply = (result: RealtimeAuthRefreshAck) => {
        (ack as (result: RealtimeAuthRefreshAck) => void)(result);
      };
      if (typeof token !== 'string' || token.length === 0 || token.length > 8192) {
        reply({ ok: false, code: 'AUTH_REQUIRED' });
        return;
      }
      const now = Date.now();
      if (refreshing || now - lastRefreshAt < (options.refreshIntervalMs ?? 5000)) {
        reply({ ok: false, code: 'RATE_LIMITED' });
        return;
      }
      // Refreshes share the handshake's verification budget.
      const releaseVerification = admission.reserveVerification();
      if (releaseVerification === null) {
        reply({ ok: false, code: 'SERVER_BUSY' });
        return;
      }
      refreshing = true;
      lastRefreshAt = now;
      void Promise.resolve()
        .then(() => options.authenticate(token))
        .then((auth) => {
          if (stopped || !socket.connected) return;
          if (auth.userId !== socket.data.userId) {
            // Another account signed in on this device; this socket's room is no longer theirs.
            reply({ ok: false, code: 'AUTH_REQUIRED' });
            socket.disconnect(true);
            return;
          }
          if (!Number.isFinite(auth.expiresAt) || auth.expiresAt <= Date.now()) {
            reply({ ok: false, code: 'AUTH_REQUIRED' });
            return;
          }
          if (auth.expiresAt > socket.data.expiresAt) {
            socket.data.expiresAt = auth.expiresAt;
            scheduleExpiry();
          }
          reply({ ok: true, expiresAt: socket.data.expiresAt });
        })
        .catch(() => reply({ ok: false, code: 'AUTH_REQUIRED' }))
        .finally(() => {
          refreshing = false;
          releaseVerification();
        });
    });
    socket.on('disconnect', () => clearTimeout(expiry));
  });
  let pending: Promise<void> | null = null;
  let requested = false;
  let continuation: ReturnType<typeof setImmediate> | null = null;
  async function dispatch() {
    // Drain bursts promptly, but yield after at most four 50-event claim pages.
    for (let page = 0; page < 4 && !stopped; page++) {
      requested = false;
      const events = await options.repository.claimEvents();
      for (const event of events) {
        if (stopped) return;
        // Recheck each event: access may be revoked while a backlog is draining.
        const allowed = await options.repository.canAccess(event.firstUserId, event.conversationId);
        if (stopped) return;
        if (allowed) {
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
      const interactions = options.interactionsEnabled
        ? await options.repository.claimInteractionEvents()
        : [];
      for (const event of interactions) {
        if (stopped) return;
        const allowed = await options.repository.canAccess(event.firstUserId, event.conversationId);
        if (stopped) return;
        if (allowed)
          io.to([`user:${event.firstUserId}`, `user:${event.secondUserId}`]).emit(
            'conversation:interactions-changed',
            { conversationId: event.conversationId, revision: event.revision },
          );
        await options.repository.completeInteractionEvent(event.conversationId, event.revision);
      }
      // A commit can arrive even while an empty claim is in flight.
      if (events.length === 0 && interactions.length === 0 && !requested) return;
    }
    requested = true;
  }
  function flush(): Promise<void> {
    if (stopped) return Promise.resolve();
    requested = true;
    if (pending !== null) return pending;
    if (continuation !== null) {
      clearImmediate(continuation);
      continuation = null;
    }
    pending = Promise.resolve()
      .then(dispatch)
      .catch((failure: unknown) => {
        // Do not spin on a failed claim/write; the timer and lease handle recovery.
        requested = false;
        options.logger.warn(
          {
            event: 'messaging_outbox_deferred',
            dispatchId: randomUUID(),
            error: describeError(failure),
          },
          'Realtime dispatch deferred; REST recovery remains authoritative',
        );
      })
      .finally(() => {
        pending = null;
        if (requested && !stopped) {
          continuation = setImmediate(() => {
            continuation = null;
            void flush();
          });
          continuation.unref();
        }
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
      if (continuation !== null) clearImmediate(continuation);
      for (const cancel of pendingAdmissions) cancel();
      await pending;
      await new Promise<void>((resolve) => {
        void io.close(() => resolve());
      });
    },
  };
}
