import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { registerDatabasePoolErrorHandler } from '../src/database-pool.js';

describe('database pool error handling', () => {
  it('keeps idle connection failures handled without logging secrets', () => {
    let errorListener: ((error: Error) => void) | undefined;
    const pool = {
      on: vi.fn((event: string, listener: (error: Error) => void) => {
        if (event === 'error') errorListener = listener;
        return pool;
      }),
    };
    const logger = pino({ level: 'silent' });
    const logError = vi.spyOn(logger, 'error');

    registerDatabasePoolErrorHandler(pool, logger);
    errorListener?.(new Error('postgres://admin:secret@example.test'));

    expect(pool.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(logError).toHaveBeenCalledWith(
      { errorType: 'Error' },
      'Idle database connection failed',
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('secret');
  });
});
