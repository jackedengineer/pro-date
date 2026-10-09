import { randomUUID } from 'node:crypto';
import {
  createDatabaseResources,
  createNotificationJobRepository,
  createNotificationReceiptRepository,
} from '@pro-date/database';
import { readNotificationWorkerEnvironment } from '../env.js';
import { createLogger } from '../logger.js';
import { registerDatabasePoolErrorHandler } from '../database-pool.js';
import { createExpoPushProvider } from './expo-push-provider.js';
import { createNotificationWorker } from './notification-worker.js';

const startupLogger = createLogger();
async function main() {
  const environment = readNotificationWorkerEnvironment();
  const logger = createLogger(environment.logLevel);
  if (!environment.notificationsEnabled) {
    logger.info(
      { event: 'push_worker_disabled' },
      'Notification storage is disabled; no database or provider work started',
    );
    return;
  }
  if (environment.expoProjectId === null)
    throw new Error('Configure the worker EAS project before starting notification work.');
  const { database, pool } = createDatabaseResources(environment.databaseUrl);
  registerDatabasePoolErrorHandler(pool, logger);
  const workerRunId = randomUUID();
  let cycleId = randomUUID();
  const worker = createNotificationWorker({
    jobs: createNotificationJobRepository(database, environment.expoProjectId),
    receipts: createNotificationReceiptRepository(database),
    provider: environment.pushEnabled
      ? createExpoPushProvider(environment.expoPushAccessToken!)
      : null,
    observe: (event, fields) => {
      const entry = { event, ...fields, workerRunId, cycleId };
      if (event.endsWith('_error')) logger.warn(entry, 'Notification worker needs attention');
      else logger.info(entry, 'Notification worker outcome');
    },
  });
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const shutdown = async () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    const deadline = setTimeout(() => {
      logger.error({ event: 'push_shutdown_timeout' }, 'Notification worker shutdown timed out');
      process.exit(1);
    }, 15_000);
    deadline.unref();
    try {
      await worker.close();
      await pool.end();
    } finally {
      clearTimeout(deadline);
    }
  };
  process.once('SIGTERM', () => {
    void shutdown().catch(() => {
      process.exitCode = 1;
    });
  });
  process.once('SIGINT', () => {
    void shutdown().catch(() => {
      process.exitCode = 1;
    });
  });
  const tick = async () => {
    cycleId = randomUUID();
    await worker.runOnce();
    if (!closed)
      timer = setTimeout(() => {
        void tick();
      }, 1000);
  };
  logger.info(
    { event: 'push_worker_started', handoffEnabled: environment.pushEnabled },
    'Notification worker started',
  );
  await tick();
}
void main().catch(() => {
  startupLogger.fatal(
    { event: 'push_worker_startup_error' },
    'Worker setup failed. Check server-only configuration; no credentials are logged.',
  );
  process.exitCode = 1;
});
