import { createApiApp } from './app.js';
import { readApiEnvironment } from './env.js';
import { createLogger } from './logger.js';

const environment = readApiEnvironment();
const logger = createLogger(environment.logLevel);
const app = createApiApp({ logger });

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

    logger.info('Graceful shutdown complete');
    process.exitCode = 0;
  });
}

server.on('error', (error) => {
  logger.fatal({ errorType: error.name }, 'HTTP server error');
  process.exitCode = 1;
});

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
