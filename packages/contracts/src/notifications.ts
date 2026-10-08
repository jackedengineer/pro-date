import { z } from 'zod';

export const notificationSettingsPatchSchema = z.strictObject({ isPaused: z.boolean() });
export const conversationNotificationPatchSchema = z.strictObject({ isEnabled: z.boolean() });
const capabilities = { isAvailable: z.boolean(), isDeliveryReady: z.boolean() };
export const notificationSettingsSchema = z.strictObject({
  isPaused: z.boolean(),
  revision: z.number().int().nonnegative(),
  ...capabilities,
});
export const conversationNotificationSchema = z.strictObject({
  conversationId: z.uuid(),
  isEnabled: z.boolean(),
  revision: z.number().int().nonnegative(),
  ...capabilities,
});
export const notificationSettingsResponseSchema = z.strictObject({
  data: notificationSettingsSchema,
  requestId: z.uuid(),
});
export const conversationNotificationResponseSchema = z.strictObject({
  data: conversationNotificationSchema,
  requestId: z.uuid(),
});
// Never route an arbitrary URL or display private text supplied by push data.
export const chatNotificationPayloadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('CHAT_MESSAGE'),
  conversationId: z.uuid(),
  messageId: z.uuid(),
  recipientId: z.uuid(),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type ConversationNotification = z.infer<typeof conversationNotificationSchema>;
export type ChatNotificationPayload = z.infer<typeof chatNotificationPayloadSchema>;
