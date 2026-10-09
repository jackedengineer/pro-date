import { describe, expect, it } from 'vitest';
import {
  notificationSettingsPatchSchema,
  conversationNotificationPatchSchema,
  chatNotificationPayloadSchema,
  notificationSettingsResponseSchema,
  notificationDeviceRegisterSchema,
  notificationDeviceRevokeSchema,
  notificationDeviceResponseSchema,
} from '../src/notifications.js';

const id = '10000000-0000-4000-8000-000000000001';
describe('private notification contracts', () => {
  it('bounds device proof, token, version and operation; ownership is never caller selected', () => {
    const input = {
      bindingSecret: 'a'.repeat(64),
      expectedVersion: 0,
      operationId: id,
      token: 'ExpoPushToken[test-token]',
      platform: 'ios',
      projectId: id,
    };
    expect(notificationDeviceRegisterSchema.parse(input)).toEqual(input);
    for (const extra of [
      { ownerId: id },
      { token: 'https://example.test' },
      { bindingSecret: 'short' },
      { expectedVersion: -1 },
      { expectedVersion: '0' },
      { expectedVersion: 2147483647 },
      { platform: 'web' },
      { operationId: 'bad' },
      { token: `ExpoPushToken[${'a'.repeat(256)}]` },
    ]) {
      expect(notificationDeviceRegisterSchema.safeParse({ ...input, ...extra }).success).toBe(
        false,
      );
    }
    expect(
      notificationDeviceRevokeSchema.safeParse({
        bindingSecret: input.bindingSecret,
        expectedVersion: 1,
        operationId: id,
      }).success,
    ).toBe(true);
    expect(notificationDeviceRevokeSchema.safeParse({ ...input }).success).toBe(false);
  });
  it('never returns a device token, binding proof or account selector', () => {
    const response = {
      data: { installationId: id, version: 1, isRegistered: true },
      requestId: id,
    };
    expect(notificationDeviceResponseSchema.parse(response)).toEqual(response);
    for (const privateField of [
      { token: 'private' },
      { bindingSecret: 'private' },
      { ownerId: id },
    ])
      expect(
        notificationDeviceResponseSchema.safeParse({
          ...response,
          data: { ...response.data, ...privateField },
        }).success,
      ).toBe(false);
  });
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
