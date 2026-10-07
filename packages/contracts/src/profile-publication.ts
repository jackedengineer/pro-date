import { z } from 'zod';

import { profilePhotoSchema } from './profile-photo';
import { profilePromptAnswerSchema } from './profile-prompt';
import { profileResponseSchema } from './profile';

export const profileReviewMissingSectionSchema = z.enum(['BASICS', 'PHOTOS', 'PROMPTS']);

export const profileReviewSchema = z.strictObject({
  missingSections: z.array(profileReviewMissingSectionSchema).max(3),
  photos: z.array(profilePhotoSchema).max(6),
  profile: profileResponseSchema.shape.data,
  prompts: z.array(profilePromptAnswerSchema).max(3),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const profileReviewResponseSchema = z.strictObject({
  data: profileReviewSchema,
  requestId: z.uuid(),
});

export type ProfileReview = z.infer<typeof profileReviewSchema>;
export type ProfileReviewMissingSection = z.infer<typeof profileReviewMissingSectionSchema>;
export type ProfileReviewResponse = z.infer<typeof profileReviewResponseSchema>;
