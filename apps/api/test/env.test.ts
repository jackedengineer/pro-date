import { describe, expect, it } from 'vitest';

import { readApiEnvironment, readApiServiceEnvironment } from '../src/env.js';

describe('readApiEnvironment', () => {
  it('fails closed instead of sending anonymously or before storage/project setup', () => {
    const input = {
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example',
      DATABASE_URL: 'postgresql://user:password@example.test/pro_date',
    };
    expect(() => readApiServiceEnvironment({ ...input, PUSH_ENABLED: 'true' })).toThrow();
    expect(() =>
      readApiServiceEnvironment({
        ...input,
        PUSH_ENABLED: 'true',
        NOTIFICATIONS_ENABLED: 'true',
        EXPO_PROJECT_ID: '10000000-0000-4000-8000-000000000001',
      }),
    ).toThrow();
    expect(
      readApiServiceEnvironment({
        ...input,
        PUSH_ENABLED: 'true',
        NOTIFICATIONS_ENABLED: 'true',
        EXPO_PROJECT_ID: '10000000-0000-4000-8000-000000000001',
        EXPO_PUSH_ACCESS_TOKEN: 'private-test-token',
      }),
    ).toMatchObject({ pushEnabled: true });
  });
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

  it('parses the private service configuration required at startup', () => {
    expect(
      readApiServiceEnvironment({
        CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        CLERK_SECRET_KEY: 'sk_test_example',
        DATABASE_URL: 'postgresql://user:password@example.test/pro_date?sslmode=require',
        LOG_LEVEL: 'warn',
        NODE_ENV: 'production',
        PORT: '8080',
      }),
    ).toEqual({
      clerkPublishableKey: 'pk_test_example',
      notificationsEnabled: false,
      pushEnabled: false,
      expoPushAccessToken: null,
      expoProjectId: null,
      clerkSecretKey: 'sk_test_example',
      cloudinary: null,
      databaseUrl: 'postgresql://user:password@example.test/pro_date?sslmode=require',
      host: '0.0.0.0',
      logLevel: 'warn',
      nodeEnv: 'production',
      port: 8080,
    });
  });

  it('parses a complete private Cloudinary configuration', () => {
    expect(
      readApiServiceEnvironment({
        CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        CLERK_SECRET_KEY: 'sk_test_example',
        CLOUDINARY_API_KEY: '123456789012345',
        CLOUDINARY_API_SECRET: 'private-cloudinary-secret',
        CLOUDINARY_CLOUD_NAME: 'pro-date-dev',
        DATABASE_URL: 'postgresql://user:password@example.test/pro_date',
      }).cloudinary,
    ).toEqual({
      apiKey: '123456789012345',
      apiSecret: 'private-cloudinary-secret',
      cloudName: 'pro-date-dev',
    });
  });

  it('enables preference storage only with an explicit flag, never a truthy string', () => {
    const input = {
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example',
      DATABASE_URL: 'postgresql://user:password@example.test/pro_date',
    };
    expect(
      readApiServiceEnvironment({ ...input, NOTIFICATIONS_ENABLED: 'true' }).notificationsEnabled,
    ).toBe(true);
    expect(() => readApiServiceEnvironment({ ...input, NOTIFICATIONS_ENABLED: '1' })).toThrow();
    expect(() =>
      readApiServiceEnvironment({ ...input, EXPO_PROJECT_ID: 'not-a-project' }),
    ).toThrow();
    expect(readApiServiceEnvironment({ ...input, EXPO_PROJECT_ID: '' }).expoProjectId).toBeNull();
    expect(
      readApiServiceEnvironment({
        ...input,
        EXPO_PROJECT_ID: '10000000-0000-4000-8000-000000000001',
      }).expoProjectId,
    ).toBe('10000000-0000-4000-8000-000000000001');
  });

  it('keeps media disabled when the optional Cloudinary secret is missing', () => {
    expect(
      readApiServiceEnvironment({
        CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        CLERK_SECRET_KEY: 'sk_test_example',
        CLOUDINARY_API_KEY: '123456789012345',
        CLOUDINARY_CLOUD_NAME: 'pro-date-dev',
        DATABASE_URL: 'postgresql://user:password@example.test/pro_date',
      }).cloudinary,
    ).toBeNull();
  });

  it.each([
    {
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example',
    },
    {
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      DATABASE_URL: 'postgresql://user:password@example.test/pro_date',
    },
    {
      CLERK_SECRET_KEY: 'sk_test_example',
      DATABASE_URL: 'postgresql://user:password@example.test/pro_date',
    },
  ])('rejects missing private service configuration: %o', (environment) => {
    expect(() => readApiServiceEnvironment(environment)).toThrow();
  });
});
