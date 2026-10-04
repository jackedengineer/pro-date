import { z } from 'zod';

export const onboardingStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']);

export const currentUserResponseSchema = z.strictObject({
  data: z.strictObject({
    id: z.uuid(),
    onboardingStatus: onboardingStatusSchema,
  }),
  requestId: z.uuid(),
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
