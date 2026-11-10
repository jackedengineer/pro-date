import type { Logger } from 'pino';

import { describeError } from './logger.js';

interface DatabasePoolErrorEmitter {
  on: (event: 'error', listener: (error: Error) => void) => unknown;
}

export function registerDatabasePoolErrorHandler(
  pool: DatabasePoolErrorEmitter,
  logger: Pick<Logger, 'error'>,
): void {
  pool.on('error', (error) => {
    logger.error({ error: describeError(error) }, 'Idle database connection failed');
  });
}
