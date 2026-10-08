import { z } from 'zod';

import { displayNameSchema, relationshipIntentSchema } from './profile';
import { profilePhotoSchema } from './profile-photo';
import { profilePromptAnswerSchema, profilePromptIdSchema } from './profile-prompt';

export const discoveryQuerySchema = z
  .strictObject({
    cursor: z.string().min(1).max(1600).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
    radiusKm: z.coerce.number().int().min(1).max(200).default(50),
    minAge: z.coerce.number().int().min(18).max(99).default(18),
    maxAge: z.coerce.number().int().min(18).max(99).default(99),
  })
  .refine((value) => value.minAge <= value.maxAge, { message: 'Choose a valid age range.' });

export const inboxQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(1600).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

// Discovery never includes a birthday, exact coordinates, private preferences, or hidden details.
export const discoveryProfileSchema = z.strictObject({
  userId: z.uuid(),
  displayName: displayNameSchema,
  age: z.number().int().min(18).max(150),
  locationLabel: z.string().min(1).max(164),
  genderIdentity: z.string().nullable(),
  pronouns: z.string().nullable(),
  heightCm: z.number().int().nullable(),
  relationshipIntent: relationshipIntentSchema,
  photos: z.array(profilePhotoSchema).min(4).max(6),
  prompts: z.array(profilePromptAnswerSchema).length(3),
});

export const pullRequestTargetSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('PHOTO'),
    id: z.uuid(),
    deliveryUrl: profilePhotoSchema.shape.deliveryUrl,
  }),
  z.strictObject({
    type: z.literal('PROMPT'),
    id: z.uuid(),
    promptId: profilePromptIdSchema,
    answer: z.string().max(280),
  }),
]);

export const sendPullRequestSchema = z.strictObject({
  recipientUserId: z.uuid(),
  targetType: z.enum(['PHOTO', 'PROMPT']),
  targetId: z.uuid(),
  comment: z.string().trim().max(280).default(''),
});

export const respondPullRequestSchema = z.strictObject({
  decision: z.enum(['MERGED', 'DECLINED']),
});
export const userTargetSchema = z.strictObject({ userId: z.uuid() });
export const reportProfileSchema = z.strictObject({
  userId: z.uuid(),
  reason: z.enum(['HARASSMENT', 'INAPPROPRIATE_CONTENT', 'SPAM', 'UNDERAGE', 'OTHER']),
  details: z.string().trim().max(1000).default(''),
});

export const pullRequestReceiptSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(['PENDING', 'MERGED', 'DECLINED']),
  matchId: z.uuid().nullable(),
});
export const incomingPullRequestSchema = z.strictObject({
  id: z.uuid(),
  sender: discoveryProfileSchema,
  target: pullRequestTargetSchema,
  comment: z.string().max(280),
  createdAt: z.iso.datetime({ offset: true }),
});
export const matchSchema = z.strictObject({
  id: z.uuid(),
  profile: discoveryProfileSchema,
  createdAt: z.iso.datetime({ offset: true }),
});

export const discoveryResponseSchema = z.strictObject({
  data: z.array(discoveryProfileSchema).max(20),
  nextCursor: z.string().nullable(),
  requestId: z.uuid(),
});
export const inboxResponseSchema = z.strictObject({
  data: z.array(incomingPullRequestSchema).max(20),
  nextCursor: z.string().nullable(),
  requestId: z.uuid(),
});
export const matchesResponseSchema = z.strictObject({
  data: z.array(matchSchema).max(20),
  nextCursor: z.string().nullable(),
  requestId: z.uuid(),
});
export const pullRequestReceiptResponseSchema = z.strictObject({
  data: pullRequestReceiptSchema,
  requestId: z.uuid(),
});
export const actionResponseSchema = z.strictObject({
  data: z.strictObject({ saved: z.literal(true) }),
  requestId: z.uuid(),
});

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;
export type InboxQuery = z.infer<typeof inboxQuerySchema>;
export type DiscoveryProfile = z.infer<typeof discoveryProfileSchema>;
export type PullRequestTarget = z.infer<typeof pullRequestTargetSchema>;
export type SendPullRequest = z.infer<typeof sendPullRequestSchema>;
export type PullRequestReceipt = z.infer<typeof pullRequestReceiptSchema>;
export type IncomingPullRequest = z.infer<typeof incomingPullRequestSchema>;
export type Match = z.infer<typeof matchSchema>;
export type ReportProfile = z.infer<typeof reportProfileSchema>;
