import { z } from 'zod';

import { onboardingStepSchema } from './current-user';

export const PROFILE_PHOTO_MIN_COUNT = 4;
export const PROFILE_PHOTO_MAX_COUNT = 6;
export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const providerPublicIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^pro-date\/users\/[0-9a-f-]{36}\/profile\/[0-9a-f-]{36}$/);

const providerSignatureSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{40,64}$/);

export const profilePhotoPositionSchema = z
  .number()
  .int()
  .min(0)
  .max(PROFILE_PHOTO_MAX_COUNT - 1);

export const profilePhotoUploadIntentResponseSchema = z.strictObject({
  data: z.strictObject({
    apiKey: z.string().trim().min(1).max(255),
    cloudName: z.string().trim().min(1).max(255),
    maxBytes: z.literal(PROFILE_PHOTO_MAX_BYTES),
    publicId: providerPublicIdSchema,
    signature: providerSignatureSchema,
    timestamp: z.number().int().positive(),
    uploadUrl: z.url().startsWith('https://api.cloudinary.com/'),
  }),
  requestId: z.uuid(),
});

export const createProfilePhotoRequestSchema = z.strictObject({
  position: profilePhotoPositionSchema,
  publicId: providerPublicIdSchema,
  signature: providerSignatureSchema,
  version: z.number().int().positive(),
});

export const profilePhotoSchema = z.strictObject({
  deliveryUrl: z.url().startsWith('https://res.cloudinary.com/'),
  height: z.number().int().positive(),
  id: z.uuid(),
  position: profilePhotoPositionSchema,
  width: z.number().int().positive(),
});

export const profilePhotoListResponseSchema = z.strictObject({
  data: z.array(profilePhotoSchema).max(PROFILE_PHOTO_MAX_COUNT),
  onboardingStep: onboardingStepSchema,
  requestId: z.uuid(),
});

export const completeProfilePhotosRequestSchema = z.strictObject({
  photoIds: z
    .array(z.uuid())
    .min(PROFILE_PHOTO_MIN_COUNT)
    .max(PROFILE_PHOTO_MAX_COUNT)
    .refine((photoIds) => new Set(photoIds).size === photoIds.length, {
      message: 'Choose each profile photo only once.',
    }),
});

export type CompleteProfilePhotosRequest = z.infer<typeof completeProfilePhotosRequestSchema>;
export type CreateProfilePhotoRequest = z.infer<typeof createProfilePhotoRequestSchema>;
export type ProfilePhoto = z.infer<typeof profilePhotoSchema>;
export type ProfilePhotoListResponse = z.infer<typeof profilePhotoListResponseSchema>;
export type ProfilePhotoUploadIntentResponse = z.infer<
  typeof profilePhotoUploadIntentResponseSchema
>;
