import type { NotificationJobRepository, NotificationReceiptRepository } from '@pro-date/database';
import type { ExpoPushProvider } from './expo-push-provider.js';

interface WorkerPorts {
  jobs: NotificationJobRepository;
  receipts: NotificationReceiptRepository;
  provider: ExpoPushProvider | null;
  observe: (event: string, fields: Record<string, number | string>) => void;
  now?: () => number;
  random?: () => number;
}
/** PostgreSQL owns retry state. No in-memory queue, and no provider call on the message request path. */
export function createNotificationWorker(ports: WorkerPorts) {
  const now = ports.now ?? Date.now;
  const random = ports.random ?? Math.random;
  let circuitUntil = 0;
  let closed = false;
  let flight: Promise<void> | null = null;
  const openCircuit = () => {
    circuitUntil = now() + 300_000;
    ports.observe('push_configuration_error', { cooldownMs: 300_000 });
  };
  async function receipts() {
    const work = await ports.receipts.claim();
    await Promise.all(
      work.map(async (receipt) => {
        try {
          if (closed || now() < circuitUntil) return;
          const result = await ports.provider!.receipt(receipt.ticketId);
          if ('code' in result && result.code === 'CONFIGURATION') openCircuit();
          const status =
            result.kind === 'OK'
              ? 'OK'
              : result.kind === 'ERROR' && result.code !== 'CONFIGURATION'
                ? 'ERROR'
                : 'PENDING';
          await ports.receipts.finish(receipt, status, 'code' in result ? result.code : null);
          if ('code' in result && result.code === 'INVALID_DEVICE')
            await ports.jobs.retire(receipt.deviceId, receipt.deviceGeneration);
          ports.observe('push_receipt', { outcome: status });
        } catch {
          ports.observe('push_receipt_error', { outcome: 'RETRY_AFTER_LEASE' });
        }
      }),
    );
  }
  async function send() {
    const claims = await ports.jobs.claim();
    await Promise.all(
      claims.map(async (claim) => {
        try {
          if (closed || now() < circuitUntil) return;
          const attempt = await ports.jobs.prepare(claim);
          if (attempt === null || closed || now() < circuitUntil) return;
          if (!(await ports.jobs.authorize(attempt))) {
            await ports.jobs.finish(attempt, {
              outcome: 'FAILED',
              errorCode: 'INELIGIBLE',
              nextAttemptAt: new Date(now()),
            });
            return;
          }
          if (closed || now() < circuitUntil) return;
          const ttl = Math.floor((attempt.expiresAt.getTime() - now()) / 1000);
          if (ttl <= 0) return;
          const startedAt = now();
          const result = await ports.provider!.send({
            token: attempt.token,
            payload: attempt.payload,
            ttl: Math.min(ttl, 86400),
          });
          if ('code' in result && result.code === 'CONFIGURATION') openCircuit();
          // Credential repair must not permanently discard an otherwise eligible alert.
          const outcome =
            'code' in result && result.code === 'CONFIGURATION' ? 'RETRYABLE' : result.kind;
          const delay = Math.min(
            900_000,
            Math.max(
              5_000 * 2 ** (attempt.attemptNumber - 1) * (0.8 + random() * 0.4),
              'retryAfterMs' in result ? (result.retryAfterMs ?? 0) : 0,
            ),
          );
          await ports.jobs.finish(attempt, {
            outcome,
            errorCode: 'code' in result ? result.code : null,
            ...(result.kind === 'ACCEPTED' ? { ticketId: result.ticketId } : {}),
            nextAttemptAt: new Date(Math.max(now() + Math.ceil(delay), circuitUntil)),
          });
          if ('code' in result && result.code === 'INVALID_DEVICE')
            await ports.jobs.retire(attempt.deviceId, attempt.deviceGeneration);
          ports.observe('push_attempt', {
            outcome,
            code: 'code' in result ? result.code : 'NONE',
            attempt: attempt.attemptNumber,
            durationMs: Math.max(0, now() - startedAt),
            queueAgeMs: Math.max(0, startedAt - attempt.createdAt.getTime()),
          });
        } catch {
          ports.observe('push_attempt_error', { outcome: 'RECOVER_AFTER_LEASE' });
        }
      }),
    );
  }
  async function cycle() {
    try {
      await ports.receipts.expire();
      await ports.jobs.housekeep();
      if (closed || ports.provider === null || now() < circuitUntil) return;
      await receipts();
      if (!closed && now() >= circuitUntil) await send();
    } catch {
      ports.observe('push_cycle_error', { outcome: 'RETRY_NEXT_CYCLE' });
    }
  }
  return {
    runOnce(): Promise<void> {
      if (closed) return Promise.resolve();
      if (flight !== null) return flight;
      flight = cycle().finally(() => {
        flight = null;
      });
      return flight;
    },
    async close() {
      closed = true;
      await flight;
    },
  };
}
