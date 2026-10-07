import type { Logger } from 'pino';

interface DatabasePoolErrorEmitter {
  on: (event: 'error', listener: (error: Error) => void) => unknown;
}

export function registerDatabasePoolErrorHandler(
  pool: DatabasePoolErrorEmitter,
  logger: Pick<Logger, 'error'>,
): void {
  pool.on('error', (error) => {
    logger.error({ errorType: error.name }, 'Idle database connection failed');
  });
}
