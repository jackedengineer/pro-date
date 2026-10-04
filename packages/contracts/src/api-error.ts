import { z } from 'zod';

export const apiErrorDetailSchema = z.strictObject({
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(200),
  path: z.string().min(1).max(128),
});

export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
    details: z.array(apiErrorDetailSchema).max(20).optional(),
    message: z.string().min(1).max(200),
  }),
  requestId: z.uuid(),
});

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
