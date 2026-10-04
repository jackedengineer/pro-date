import { z } from 'zod';

const apiEnvironmentSchema = z.object({
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export interface ApiEnvironment {
  host: string;
  logLevel: z.infer<typeof apiEnvironmentSchema>['LOG_LEVEL'];
  nodeEnv: z.infer<typeof apiEnvironmentSchema>['NODE_ENV'];
  port: number;
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
