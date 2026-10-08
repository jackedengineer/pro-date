import {
  conversationNotificationResponseSchema,
  notificationSettingsResponseSchema,
} from '@pro-date/contracts';
import { ApiRequestError, createHttpClient } from './http-client';

export function createNotificationsApi(options: Parameters<typeof createHttpClient>[0]) {
  const request = createHttpClient(options);
  async function notificationRequest<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (failure: unknown) {
      // Unlike message intents, a settings request is not a durable offline queue.
      if (failure instanceof ApiRequestError && failure.status === 0)
        throw new ApiRequestError(
          'Couldn’t confirm this setting. Go online and refresh before retrying.',
          0,
          failure.code,
          failure.retryable,
        );
      throw failure;
    }
  }
  const path = (id: string) =>
    `/v1/conversations/${encodeURIComponent(id)}/notification-preference`;
  return {
    settings: (signal?: AbortSignal) =>
      notificationRequest(
        async () =>
          (
            await request('/v1/notification-settings', notificationSettingsResponseSchema, {
              signal: signal ?? null,
            })
          ).data,
      ),
    saveSettings: (isPaused: boolean, signal?: AbortSignal) =>
      notificationRequest(
        async () =>
          (
            await request('/v1/notification-settings', notificationSettingsResponseSchema, {
              method: 'PATCH',
              body: JSON.stringify({ isPaused }),
              signal: signal ?? null,
            })
          ).data,
      ),
    conversation: (id: string, signal?: AbortSignal) =>
      notificationRequest(
        async () =>
          (
            await request(path(id), conversationNotificationResponseSchema, {
              signal: signal ?? null,
            })
          ).data,
      ),
    saveConversation: (id: string, isEnabled: boolean, signal?: AbortSignal) =>
      notificationRequest(
        async () =>
          (
            await request(path(id), conversationNotificationResponseSchema, {
              method: 'PATCH',
              body: JSON.stringify({ isEnabled }),
              signal: signal ?? null,
            })
          ).data,
      ),
  };
}
export type NotificationsApi = ReturnType<typeof createNotificationsApi>;
