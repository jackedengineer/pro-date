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

export const birthDateSchema = z.iso.date();

export const updateProfileRequestSchema = z
  .strictObject({
    birthDate: birthDateSchema.optional(),
    displayName: displayNameSchema.optional(),
  })
  .refine(
    (profile) =>
      Number(profile.birthDate !== undefined) + Number(profile.displayName !== undefined) === 1,
    {
      message: 'Update exactly one profile field at a time.',
      path: ['profile'],
    },
  );

export const profileResponseSchema = z.strictObject({
  data: z.strictObject({
    birthDate: birthDateSchema.nullable(),
    displayName: displayNameSchema.nullable(),
    onboardingStatus: onboardingStatusSchema,
    onboardingStep: onboardingStepSchema,
  }),
  requestId: z.uuid(),
});

export function isAtLeastAge(
  birthDate: string,
  referenceDate: string,
  minimumAge: number,
): boolean {
  if (
    !birthDateSchema.safeParse(birthDate).success ||
    !birthDateSchema.safeParse(referenceDate).success ||
    !Number.isInteger(minimumAge) ||
    minimumAge < 0
  ) {
    return false;
  }

  const birthYear = Number(birthDate.slice(0, 4));
  const birthMonthDay = birthDate.slice(5);
  const referenceYear = Number(referenceDate.slice(0, 4));
  const referenceMonthDay = referenceDate.slice(5);
  const age = referenceYear - birthYear - (referenceMonthDay < birthMonthDay ? 1 : 0);

  return age >= minimumAge;
}

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
