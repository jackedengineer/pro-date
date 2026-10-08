import { describe, expect, it } from 'vitest';
import {
  notificationSettingsPatchSchema,
  conversationNotificationPatchSchema,
  chatNotificationPayloadSchema,
  notificationSettingsResponseSchema,
} from '../src/notifications.js';

const id = '10000000-0000-4000-8000-000000000001';
describe('private notification contracts', () => {
  it('accepts desired states, never caller-selected ownership or coerced booleans', () => {
    expect(notificationSettingsPatchSchema.parse({ isPaused: true })).toEqual({ isPaused: true });
    expect(conversationNotificationPatchSchema.parse({ isEnabled: false })).toEqual({
      isEnabled: false,
    });
    for (const input of [{ isEnabled: 'true' }, { isEnabled: true, userId: id }, {}])
      expect(conversationNotificationPatchSchema.safeParse(input).success).toBe(false);
  });
  it('allowlists notification navigation and rejects private content/arbitrary URLs', () => {
    const payload = {
      version: 1,
      type: 'CHAT_MESSAGE',
      conversationId: id,
      messageId: id,
      recipientId: id,
    };
    expect(chatNotificationPayloadSchema.parse(payload)).toEqual(payload);
    for (const extra of [
      { body: 'Private message' },
      { url: 'https://attacker.test' },
      { senderName: 'Avery' },
    ])
      expect(chatNotificationPayloadSchema.safeParse({ ...payload, ...extra }).success).toBe(false);
    expect(chatNotificationPayloadSchema.safeParse({ ...payload, version: 2 }).success).toBe(false);
  });
  it('distinguishes preference storage availability from push delivery readiness', () => {
    expect(
      notificationSettingsResponseSchema.parse({
        data: { isPaused: false, revision: 0, isAvailable: false, isDeliveryReady: false },
        requestId: id,
      }).data.isDeliveryReady,
    ).toBe(false);
  });
});
