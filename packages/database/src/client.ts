import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

import * as schema from './schema.js';

export type ProDateDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseResources {
  database: ProDateDatabase;
  pool: Pool;
}

export function createPostgresPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  };
}

export function createDatabaseResources(connectionString: string): DatabaseResources {
  const pool = new Pool(createPostgresPoolConfig(connectionString));
  const database = drizzle(pool, { schema });

  return { database, pool };
}
