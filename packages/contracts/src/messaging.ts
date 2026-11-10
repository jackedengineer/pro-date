import { z } from 'zod';

export const messageBodySchema = z.string().trim().min(1).max(2000);
/**
 * The API's explicit verdict that a conversation is gone for this member (unmatched, blocked or
 * never theirs). Clients may delete local history only on this code; any other 404, including one
 * from a proxy, a misrouted deploy or a missing message, must leave local data intact.
 */
export const CONVERSATION_UNAVAILABLE = 'CONVERSATION_UNAVAILABLE';
export const sendMessageSchema = z.strictObject({
  clientId: z.uuid(),
  body: messageBodySchema,
  replyToMessageId: z.uuid().optional(),
});

export const chatCapabilitiesSchema = z.object({
  replies: z.boolean(),
  reactions: z.boolean(),
});
export const messageQuoteSchema = z.object({
  messageId: z.uuid(),
  senderId: z.uuid(),
  excerpt: z.string().min(1).max(240),
});
export const reactionKindSchema = z.enum(['HEART', 'LAUGH', 'LOVE', 'FIRE', 'CLAP', 'LIKE']);
export const reactionStateSchema = z.object({
  userId: z.uuid(),
  reaction: reactionKindSchema.nullable(),
  revision: z.number().int().nonnegative(),
});
export const messageContextSchema = z.object({
  messageId: z.uuid(),
  revision: z.number().int().nonnegative(),
  replyTo: messageQuoteSchema.nullable(),
  reactions: z.array(reactionStateSchema).max(2),
});
export const messageContextQuerySchema = z.strictObject({
  ids: z
    .string()
    .max(1849)
    .transform((value) => value.split(','))
    .pipe(
      z
        .array(z.uuid())
        .min(1)
        .max(50)
        .refine((ids) => new Set(ids).size === ids.length),
    ),
});
export const chatCapabilitiesResponseSchema = z.object({
  data: chatCapabilitiesSchema,
  requestId: z.uuid(),
});
export const messageContextResponseSchema = z.object({
  data: z.array(messageContextSchema).max(50),
  revision: z.number().int().nonnegative(),
  requestId: z.uuid(),
});
export const setMessageReactionSchema = z.strictObject({
  reaction: reactionKindSchema.nullable(),
  expectedRevision: z.number().int().nonnegative(),
});
export const interactionChangesQuerySchema = z.strictObject({
  afterRevision: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
export const interactionChangesResponseSchema = z.object({
  data: z.array(messageContextSchema).max(50),
  nextRevision: z.number().int().nonnegative(),
  latestRevision: z.number().int().nonnegative(),
  requestId: z.uuid(),
});
export const messageReactionResponseSchema = z.object({
  data: messageContextSchema,
  requestId: z.uuid(),
});
export const conversationInteractionsChangedSchema = z.object({
  conversationId: z.uuid(),
  revision: z.number().int().positive(),
});
export type ChatCapabilities = z.infer<typeof chatCapabilitiesSchema>;
export type MessageQuote = z.infer<typeof messageQuoteSchema>;
export type MessageContext = z.infer<typeof messageContextSchema>;
export type ReactionKind = z.infer<typeof reactionKindSchema>;
export type SetMessageReaction = z.infer<typeof setMessageReactionSchema>;
export type InteractionChangesQuery = z.infer<typeof interactionChangesQuerySchema>;
export type MessageContexts = Omit<z.infer<typeof messageContextResponseSchema>, 'requestId'>;
export type InteractionChanges = Omit<
  z.infer<typeof interactionChangesResponseSchema>,
  'requestId'
>;
export const messageHistoryQuerySchema = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(50).default(50),
    cursor: z.string().min(1).max(1600).optional(),
    afterSequence: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  })
  .refine((query) => query.cursor === undefined || query.afterSequence === undefined, {
    message: 'Choose older history or forward synchronization, not both.',
  });
export const messageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  senderId: z.uuid(),
  clientId: z.uuid(),
  sequence: z.number().int().positive(),
  body: messageBodySchema,
  createdAt: z.iso.datetime({ offset: true }),
});
export const conversationMemberSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().min(1).max(40),
  photoUrl: z.url().startsWith('https://').nullable(),
});
export const conversationSchema = z.object({
  id: z.uuid(),
  member: conversationMemberSchema,
  createdAt: z.iso.datetime({ offset: true }),
  activityAt: z.iso.datetime({ offset: true }),
  lastMessage: messageSchema.nullable(),
});
export const conversationsResponseSchema = z.object({
  data: z.array(conversationSchema).max(20),
  nextCursor: z.string().nullable(),
  requestId: z.uuid(),
});
export const conversationResponseSchema = z.object({
  data: conversationSchema,
  requestId: z.uuid(),
});
export const messageResponseSchema = z.object({ data: messageSchema, requestId: z.uuid() });
export const messageHistoryResponseSchema = z.object({
  data: z.array(messageSchema).max(50),
  olderCursor: z.string().nullable(),
  nextAfterSequence: z.number().int().nonnegative().nullable(),
  latestSequence: z.number().int().nonnegative(),
  requestId: z.uuid(),
});
// Hints never carry private message text; REST always rechecks authorization.
export const conversationChangedSchema = z.object({
  conversationId: z.uuid(),
  sequence: z.number().int().positive(),
});

export const realtimeAdmissionErrorSchema = z.object({
  code: z.enum(['AUTH_REQUIRED', 'AUTH_TIMEOUT', 'RATE_LIMITED', 'SERVER_BUSY']),
  retryAfterMs: z.number().int().min(0).max(300_000).optional(),
});
export type RealtimeAdmissionError = z.infer<typeof realtimeAdmissionErrorSchema>;

/**
 * Session tokens are short-lived, and the API closes a socket when its token expires. A connected
 * client sends a fresh token on this event before then, so the socket stays open.
 */
export const REALTIME_AUTH_REFRESH_EVENT = 'auth:refresh';
export const realtimeAuthRefreshAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), expiresAt: z.number().int().positive() }),
  z.object({
    ok: z.literal(false),
    code: z.enum(['AUTH_REQUIRED', 'RATE_LIMITED', 'SERVER_BUSY']),
  }),
]);
export type RealtimeAuthRefreshAck = z.infer<typeof realtimeAuthRefreshAckSchema>;

export type SendMessage = z.infer<typeof sendMessageSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
export type MessageHistory = Omit<z.infer<typeof messageHistoryResponseSchema>, 'requestId'>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationMember = z.infer<typeof conversationMemberSchema>;
export type ConversationChanged = z.infer<typeof conversationChangedSchema>;
