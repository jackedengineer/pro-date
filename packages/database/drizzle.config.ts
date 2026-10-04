import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  ...(databaseUrl === undefined ? {} : { dbCredentials: { url: databaseUrl } }),
  dialect: 'postgresql',
  extensionsFilters: ['postgis'],
  out: './drizzle',
  schema: './src/schema.ts',
  strict: true,
  verbose: true,
});
