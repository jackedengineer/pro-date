import { clerkMiddleware, getAuth } from '@clerk/express';
import { createCurrentUserRepository, createDatabaseResources } from '@pro-date/database';

import { createApiApp } from './app.js';
import { readApiServiceEnvironment } from './env.js';
import { createLogger } from './logger.js';

const environment = readApiServiceEnvironment();
const logger = createLogger(environment.logLevel);
const { database, pool } = createDatabaseResources(environment.databaseUrl);
const currentUserRepository = createCurrentUserRepository(database);
const app = createApiApp({
  authenticationMiddleware: clerkMiddleware({
    publishableKey: environment.clerkPublishableKey,
    secretKey: environment.clerkSecretKey,
  }),
  findOrCreateCurrentUser: (clerkSubject) =>
    currentUserRepository.findOrCreateByClerkSubject(clerkSubject),
  logger,
  readinessCheck: async () => {
    await pool.query('select 1');

    return { application: 'up', database: 'up' };
  },
  resolveClerkSubject: (request) => {
    const auth = getAuth(request);

    return auth.isAuthenticated ? auth.userId : null;
  },
});

const server = app.listen(environment.port, environment.host, () => {
  logger.info(
    {
      environment: environment.nodeEnv,
      host: environment.host,
      port: environment.port,
    },
    'API listening',
  );
});

let shutdownStarted = false;

function shutdown(signal: NodeJS.Signals) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);

    if (error !== undefined) {
      logger.error({ errorType: error.name }, 'HTTP server failed to close');
      process.exitCode = 1;
      return;
    }

    void pool
      .end()
      .then(() => {
        logger.info('Graceful shutdown complete');
        process.exitCode = 0;
      })
      .catch((poolError: unknown) => {
        logger.error(
          { errorType: poolError instanceof Error ? poolError.name : 'UnknownError' },
          'Database pool failed to close',
        );
        process.exitCode = 1;
      });
  });
}

server.on('error', (error) => {
  logger.fatal({ errorType: error.name }, 'HTTP server error');
  process.exitCode = 1;
});

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
