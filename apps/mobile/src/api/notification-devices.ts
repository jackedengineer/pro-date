import {
  notificationDeviceResponseSchema,
  type NotificationDeviceRegister,
  type NotificationDeviceRevoke,
} from '@pro-date/contracts';
import { ApiRequestError, createHttpClient } from './http-client';

/** Create with the authenticated owner's token callback; never share across sessions. */
export function createNotificationDevicesApi(
  options: Parameters<typeof createHttpClient>[0] & {
    ownerId: string;
    currentOwner: () => string | null;
  },
) {
  const assertOwner = () => {
    if (options.currentOwner() !== options.ownerId)
      throw new ApiRequestError(
        'Notification session changed. Reopen settings in your current account.',
        401,
        'SESSION_CHANGED',
        false,
      );
  };
  const request = createHttpClient({
    ...options,
    getToken: async () => {
      assertOwner();
      const token = await options.getToken();
      assertOwner();
      return token;
    },
  });
  async function send(
    installationId: string,
    method: 'PUT' | 'DELETE',
    input: NotificationDeviceRegister | NotificationDeviceRevoke,
    signal?: AbortSignal,
  ) {
    try {
      return (
        await request(path(installationId), notificationDeviceResponseSchema, {
          method,
          body: JSON.stringify(input),
          signal: signal ?? null,
        })
      ).data;
    } catch (failure: unknown) {
      if (failure instanceof ApiRequestError && failure.status === 0)
        throw new ApiRequestError(
          'Couldn’t confirm this device change. Reconnect to retry the same operation.',
          0,
          failure.code,
          failure.retryable,
        );
      throw failure;
    }
  }
  const path = (installationId: string) =>
    `/v1/notification-devices/${encodeURIComponent(installationId)}`;
  return {
    register: (installationId: string, input: NotificationDeviceRegister, signal?: AbortSignal) =>
      send(installationId, 'PUT', input, signal),
    revoke: (installationId: string, input: NotificationDeviceRevoke, signal?: AbortSignal) =>
      send(installationId, 'DELETE', input, signal),
  };
}
export type NotificationDevicesApi = ReturnType<typeof createNotificationDevicesApi>;
