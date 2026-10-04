import { describe, expect, it } from 'vitest';

import { readApiEnvironment } from '../src/env.js';

describe('readApiEnvironment', () => {
  it('provides safe local defaults', () => {
    expect(readApiEnvironment({})).toEqual({
      host: '0.0.0.0',
      logLevel: 'info',
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('parses a valid deployment environment', () => {
    expect(
      readApiEnvironment({
        HOST: '127.0.0.1',
        LOG_LEVEL: 'warn',
        NODE_ENV: 'production',
        PORT: '8080',
      }),
    ).toEqual({
      host: '127.0.0.1',
      logLevel: 'warn',
      nodeEnv: 'production',
      port: 8080,
    });
  });

  it.each([
    { PORT: '0' },
    { PORT: '3.14' },
    { PORT: 'not-a-port' },
    { LOG_LEVEL: 'everything' },
    { NODE_ENV: 'staging' },
  ])('rejects an invalid environment: %o', (environment) => {
    expect(() => readApiEnvironment(environment)).toThrow();
  });
});
