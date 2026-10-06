import { z } from 'zod';

export const onboardingStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']);
export const onboardingStepSchema = z.enum([
  'NAME',
  'BIRTHDAY',
  'IDENTITY',
  'PREFERENCES',
  'LOCATION',
  'DETAILS',
  'PHOTOS',
  'PROMPTS',
  'REVIEW',
  'COMPLETE',
]);

export const currentUserResponseSchema = z.strictObject({
  data: z.strictObject({
    id: z.uuid(),
    onboardingStep: onboardingStepSchema,
    onboardingStatus: onboardingStatusSchema,
  }),
  requestId: z.uuid(),
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
