import { z } from 'zod';

const deviceOperation = {
  bindingSecret: z.string().regex(/^[a-f0-9]{64}$/),
  expectedVersion: z.number().int().min(0).max(2147483646),
  operationId: z.uuid(),
};
export const notificationDeviceRegisterSchema = z.strictObject({
  ...deviceOperation,
  token: z
    .string()
    .max(256)
    .regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/),
  platform: z.enum(['ios', 'android']),
  projectId: z.uuid(),
});
export const notificationDeviceRevokeSchema = z.strictObject(deviceOperation);
export const notificationDeviceReceiptSchema = z.strictObject({
  installationId: z.uuid(),
  version: z.number().int().positive().max(2147483647),
  isRegistered: z.boolean(),
});
export const notificationDeviceResponseSchema = z.strictObject({
  data: notificationDeviceReceiptSchema,
  requestId: z.uuid(),
});
export type NotificationDeviceRegister = z.infer<typeof notificationDeviceRegisterSchema>;
export type NotificationDeviceRevoke = z.infer<typeof notificationDeviceRevokeSchema>;
export type NotificationDeviceReceipt = z.infer<typeof notificationDeviceReceiptSchema>;

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
