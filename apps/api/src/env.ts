import { z } from 'zod';

const apiEnvironmentSchema = z.object({
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

const apiServiceEnvironmentSchema = apiEnvironmentSchema.extend({
  NOTIFICATIONS_ENABLED: z.enum(['true', 'false']).default('false'),
  PUSH_ENABLED: z.enum(['true', 'false']).default('false'),
  EXPO_PUSH_ACCESS_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .regex(/^[^\r\n]+$/)
      .optional(),
  ),
  EXPO_PROJECT_ID: z.preprocess((value) => (value === '' ? undefined : value), z.uuid().optional()),
  CLERK_PUBLISHABLE_KEY: z.string().trim().startsWith('pk_'),
  CLERK_SECRET_KEY: z.string().trim().startsWith('sk_'),
  CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional(),
  DATABASE_URL: z
    .url()
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must use the postgres or postgresql protocol.',
    ),
});

export interface CloudinaryEnvironment {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
}

export interface ApiEnvironment {
  host: string;
  logLevel: z.infer<typeof apiEnvironmentSchema>['LOG_LEVEL'];
  nodeEnv: z.infer<typeof apiEnvironmentSchema>['NODE_ENV'];
  port: number;
}

export interface ApiServiceEnvironment extends ApiEnvironment {
  notificationsEnabled: boolean;
  pushEnabled: boolean;
  expoPushAccessToken: string | null;
  expoProjectId: string | null;
  clerkPublishableKey: string;
  clerkSecretKey: string;
  cloudinary: CloudinaryEnvironment | null;
  databaseUrl: string;
}

export function readApiEnvironment(
  input: Record<string, string | undefined> = process.env,
): ApiEnvironment {
  const environment = apiEnvironmentSchema.parse(input);

  return {
    host: environment.HOST,
    logLevel: environment.LOG_LEVEL,
    nodeEnv: environment.NODE_ENV,
    port: environment.PORT,
  };
}

export function readApiServiceEnvironment(
  input: Record<string, string | undefined> = process.env,
): ApiServiceEnvironment {
  const environment = apiServiceEnvironmentSchema.parse(input);
  validatePushEnvironment(environment);
  const cloudinary =
    environment.CLOUDINARY_API_KEY !== undefined &&
    environment.CLOUDINARY_API_SECRET !== undefined &&
    environment.CLOUDINARY_CLOUD_NAME !== undefined
      ? {
          apiKey: environment.CLOUDINARY_API_KEY,
          apiSecret: environment.CLOUDINARY_API_SECRET,
          cloudName: environment.CLOUDINARY_CLOUD_NAME,
        }
      : null;

  return {
    notificationsEnabled: environment.NOTIFICATIONS_ENABLED === 'true',
    pushEnabled: environment.PUSH_ENABLED === 'true',
    expoPushAccessToken: environment.EXPO_PUSH_ACCESS_TOKEN ?? null,
    expoProjectId: environment.EXPO_PROJECT_ID ?? null,
    clerkPublishableKey: environment.CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: environment.CLERK_SECRET_KEY,
    cloudinary,
    databaseUrl: environment.DATABASE_URL,
    host: environment.HOST,
    logLevel: environment.LOG_LEVEL,
    nodeEnv: environment.NODE_ENV,
    port: environment.PORT,
  };
}

function validatePushEnvironment(
  environment: Pick<
    z.infer<typeof apiServiceEnvironmentSchema>,
    'PUSH_ENABLED' | 'NOTIFICATIONS_ENABLED' | 'EXPO_PROJECT_ID' | 'EXPO_PUSH_ACCESS_TOKEN'
  >,
) {
  if (
    environment.PUSH_ENABLED === 'true' &&
    (environment.NOTIFICATIONS_ENABLED !== 'true' ||
      !environment.EXPO_PROJECT_ID ||
      !environment.EXPO_PUSH_ACCESS_TOKEN)
  )
    throw new Error(
      'Push delivery requires notification storage, an EAS project and enhanced server-only push authentication.',
    );
}

/** The private worker needs no Clerk or Cloudinary credentials. */
export function readNotificationWorkerEnvironment(
  input: Record<string, string | undefined> = process.env,
) {
  const environment = apiServiceEnvironmentSchema
    .pick({
      NOTIFICATIONS_ENABLED: true,
      PUSH_ENABLED: true,
      EXPO_PROJECT_ID: true,
      EXPO_PUSH_ACCESS_TOKEN: true,
      DATABASE_URL: true,
      LOG_LEVEL: true,
    })
    .parse(input);
  validatePushEnvironment(environment);
  return {
    notificationsEnabled: environment.NOTIFICATIONS_ENABLED === 'true',
    pushEnabled: environment.PUSH_ENABLED === 'true',
    expoProjectId: environment.EXPO_PROJECT_ID ?? null,
    expoPushAccessToken: environment.EXPO_PUSH_ACCESS_TOKEN ?? null,
    databaseUrl: environment.DATABASE_URL,
    logLevel: environment.LOG_LEVEL,
  };
}
