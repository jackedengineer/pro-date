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

const profileTextSchema = (maximumLength: number) =>
  z.string().trim().min(2).max(maximumLength).refine(hasNoAsciiControlCharacters);

export const genderIdentitySchema = profileTextSchema(40);
export const pronounsSchema = profileTextSchema(30);

export const interestedInValueSchema = z.enum(['WOMEN', 'MEN', 'NON_BINARY_PEOPLE']);
export const interestedInSchema = z
  .array(interestedInValueSchema)
  .min(1)
  .max(interestedInValueSchema.options.length)
  .refine((values) => new Set(values).size === values.length, {
    message: 'Choose each dating preference only once.',
  });

export const relationshipIntentSchema = z.enum([
  'LONG_TERM',
  'LONG_TERM_OPEN_TO_SHORT',
  'SHORT_TERM_OPEN_TO_LONG',
  'SHORT_TERM',
  'FIGURING_IT_OUT',
  'FRIENDSHIP',
]);

export const identityUpdateSchema = z.strictObject({
  arePronounsVisible: z.boolean(),
  genderIdentity: genderIdentitySchema,
  isGenderVisible: z.boolean(),
  pronouns: pronounsSchema,
});

export const preferencesUpdateSchema = z.strictObject({
  interestedIn: interestedInSchema,
  relationshipIntent: relationshipIntentSchema,
});

export const locationUpdateSchema = z.strictObject({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  latitude: z.number().finite().min(-90).max(90),
  locality: z.string().trim().min(1).max(80).refine(hasNoAsciiControlCharacters),
  longitude: z.number().finite().min(-180).max(180),
  region: z.string().trim().min(1).max(80).refine(hasNoAsciiControlCharacters).nullable(),
});

export const heightUpdateSchema = z.strictObject({
  centimeters: z.number().int().min(120).max(230),
  isVisible: z.boolean(),
});

export const updateProfileRequestSchema = z
  .strictObject({
    birthDate: birthDateSchema.optional(),
    displayName: displayNameSchema.optional(),
    height: heightUpdateSchema.optional(),
    identity: identityUpdateSchema.optional(),
    location: locationUpdateSchema.optional(),
    preferences: preferencesUpdateSchema.optional(),
  })
  .refine(
    (profile) =>
      [
        profile.birthDate,
        profile.displayName,
        profile.height,
        profile.identity,
        profile.location,
        profile.preferences,
      ].filter((value) => value !== undefined).length === 1,
    {
      message: 'Update exactly one profile field at a time.',
      path: ['profile'],
    },
  );

export const profileResponseSchema = z.strictObject({
  data: z.strictObject({
    arePronounsVisible: z.boolean(),
    birthDate: birthDateSchema.nullable(),
    displayName: displayNameSchema.nullable(),
    genderIdentity: genderIdentitySchema.nullable(),
    hasLocation: z.boolean(),
    heightCm: heightUpdateSchema.shape.centimeters.nullable(),
    interestedIn: interestedInSchema.or(z.tuple([])),
    isGenderVisible: z.boolean(),
    isHeightVisible: z.boolean(),
    locationLabel: z.string().min(1).max(164).nullable(),
    onboardingStatus: onboardingStatusSchema,
    onboardingStep: onboardingStepSchema,
    pronouns: pronounsSchema.nullable(),
    relationshipIntent: relationshipIntentSchema.nullable(),
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
export type HeightUpdate = z.infer<typeof heightUpdateSchema>;
export type IdentityUpdate = z.infer<typeof identityUpdateSchema>;
export type InterestedInValue = z.infer<typeof interestedInValueSchema>;
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;
export type RelationshipIntent = z.infer<typeof relationshipIntentSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
