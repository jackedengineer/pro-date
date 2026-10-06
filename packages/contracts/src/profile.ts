import { z } from 'zod';

import { onboardingStatusSchema, onboardingStepSchema } from './current-user';

function hasNoAsciiControlCharacters(value: string): boolean {
  return Array.from(value).every((character) => {
    const codePoint = character.codePointAt(0);

    return codePoint !== undefined && codePoint >= 32 && codePoint !== 127;
  });
}

export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .refine(hasNoAsciiControlCharacters);

export const updateProfileRequestSchema = z.strictObject({
  displayName: displayNameSchema,
});

export const profileResponseSchema = z.strictObject({
  data: z.strictObject({
    displayName: displayNameSchema,
    onboardingStatus: onboardingStatusSchema,
    onboardingStep: onboardingStepSchema,
  }),
  requestId: z.uuid(),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
