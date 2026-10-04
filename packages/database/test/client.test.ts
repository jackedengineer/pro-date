import { describe, expect, it } from 'vitest';

import { createPostgresPoolConfig } from '../src/client.js';

describe('database client', () => {
  it('uses bounded connection-pool defaults for the long-running API service', () => {
    expect(
      createPostgresPoolConfig('postgresql://user:password@example.test/pro_date?sslmode=require'),
    ).toEqual({
      connectionString: 'postgresql://user:password@example.test/pro_date?sslmode=require',
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
  });
});
