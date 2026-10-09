import { z } from 'zod';

export const messageBodySchema = z.string().trim().min(1).max(2000);
export const sendMessageSchema = z.strictObject({ clientId: z.uuid(), body: messageBodySchema });
export const messageHistoryQuerySchema = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(50).default(50),
    cursor: z.string().min(1).max(1600).optional(),
    afterSequence: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  })
  .refine((query) => query.cursor === undefined || query.afterSequence === undefined, {
    message: 'Choose older history or forward synchronization, not both.',
  });
export const messageSchema = z.strictObject({
  id: z.uuid(),
  conversationId: z.uuid(),
  senderId: z.uuid(),
  clientId: z.uuid(),
  sequence: z.number().int().positive(),
  body: messageBodySchema,
  createdAt: z.iso.datetime({ offset: true }),
});
export const conversationMemberSchema = z.strictObject({
  userId: z.uuid(),
  displayName: z.string().min(1).max(40),
  photoUrl: z.url().startsWith('https://').nullable(),
});
export const conversationSchema = z.strictObject({
  id: z.uuid(),
  member: conversationMemberSchema,
  createdAt: z.iso.datetime({ offset: true }),
  activityAt: z.iso.datetime({ offset: true }),
  lastMessage: messageSchema.nullable(),
});
export const conversationsResponseSchema = z.strictObject({
  data: z.array(conversationSchema).max(20),
  nextCursor: z.string().nullable(),
  requestId: z.uuid(),
});
export const conversationResponseSchema = z.strictObject({
  data: conversationSchema,
  requestId: z.uuid(),
});
export const messageResponseSchema = z.strictObject({ data: messageSchema, requestId: z.uuid() });
export const messageHistoryResponseSchema = z.strictObject({
  data: z.array(messageSchema).max(50),
  olderCursor: z.string().nullable(),
  nextAfterSequence: z.number().int().nonnegative().nullable(),
  latestSequence: z.number().int().nonnegative(),
  requestId: z.uuid(),
});
// Hints never carry private message text; REST always rechecks authorization.
export const conversationChangedSchema = z.strictObject({
  conversationId: z.uuid(),
  sequence: z.number().int().positive(),
});

export const realtimeAdmissionErrorSchema = z.strictObject({
  code: z.enum(['AUTH_REQUIRED', 'AUTH_TIMEOUT', 'RATE_LIMITED', 'SERVER_BUSY']),
  retryAfterMs: z.number().int().min(0).max(300_000).optional(),
});
export type RealtimeAdmissionError = z.infer<typeof realtimeAdmissionErrorSchema>;

export type SendMessage = z.infer<typeof sendMessageSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
export type MessageHistory = Omit<z.infer<typeof messageHistoryResponseSchema>, 'requestId'>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationMember = z.infer<typeof conversationMemberSchema>;
export type ConversationChanged = z.infer<typeof conversationChangedSchema>;
