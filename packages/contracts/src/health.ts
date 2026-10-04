import { z } from 'zod';

const healthResponseBase = {
  requestId: z.uuid(),
  service: z.literal('api'),
  timestamp: z.iso.datetime({ offset: true }),
};

const healthyResponseSchema = z.strictObject({
  ...healthResponseBase,
  checks: z.record(z.string().min(1).max(64), z.literal('up')).optional(),
  status: z.literal('ok'),
});

const unavailableResponseSchema = z.strictObject({
  ...healthResponseBase,
  checks: z.record(z.string().min(1).max(64), z.enum(['up', 'down'])).optional(),
  status: z.literal('unavailable'),
});

export const healthResponseSchema = z.discriminatedUnion('status', [
  healthyResponseSchema,
  unavailableResponseSchema,
]);

export type HealthResponse = z.infer<typeof healthResponseSchema>;
