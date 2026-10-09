import { cleanup, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { NotificationEvents } from './notification-events';
import { notificationDevice } from './notification-device';
import { useMessaging, type MessagingRuntime } from '../messaging/messaging-provider';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  usePathname: () => '/discover',
}));
jest.mock('./notification-device', () => ({ notificationDevice: { supported: true } }));
jest.mock('../messaging/messaging-provider', () => ({ useMessaging: jest.fn() }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));
const id = '10000000-0000-4000-8000-000000000001';
const data = {
  version: 1,
  type: 'CHAT_MESSAGE',
  conversationId: id,
  messageId: id,
  recipientId: id,
};
const notification = {
  request: {
    identifier: 'notification',
    content: { title: 'ProDate', body: 'New message on ProDate.', data },
  },
} as unknown as Notifications.Notification;
const response = {
  actionIdentifier: 'default',
  notification,
} as Notifications.NotificationResponse;
const load = () => Promise.resolve(Notifications);
function setup(runtimeAvailable = true) {
  const runtime = {
    ownerId: id,
    isCurrent: () => true,
    api: { conversation: jest.fn().mockResolvedValue({ id }) },
    notifications: {
      settings: jest
        .fn()
        .mockResolvedValue({ isAvailable: true, isDeliveryReady: true, isPaused: false }),
      conversation: jest.fn().mockResolvedValue({ isEnabled: true }),
    },
  } as unknown as MessagingRuntime;
  jest
    .mocked(useMessaging)
    .mockReturnValue({ runtime: runtimeAvailable ? runtime : null, error: null, retry: jest.fn() });
  const remove = jest.fn();
  jest.mocked(Notifications.addNotificationResponseReceivedListener).mockReturnValue({ remove });
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  return { runtime, remove };
}
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
describe('SDK notification event wiring', () => {
  it('removes the listener even if the initial native response lookup fails', async () => {
    const test = setup();
    jest.mocked(Notifications.getLastNotificationResponse).mockImplementationOnce(() => {
      throw new Error('Native response unavailable');
    });
    const view = await render(<NotificationEvents load={load} />);
    await waitFor(() => expect(Notifications.getLastNotificationResponse).toHaveBeenCalled());
    await view.unmount();
    expect(test.remove).toHaveBeenCalledTimes(1);
    expect(Notifications.setNotificationHandler).toHaveBeenLastCalledWith(null);
  });
  it('does not load/register unsupported Expo Go push listeners', async () => {
    setup();
    const supported = notificationDevice.supported;
    Object.assign(notificationDevice, { supported: false });
    try {
      await render(<NotificationEvents load={load} />);
      expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
    } finally {
      Object.assign(notificationDevice, { supported });
    }
  });
  it('handles cold and listener responses once, clears native pending response, and cleans up', async () => {
    const test = setup();
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(response);
    const view = await render(<NotificationEvents load={load} />);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock
      .calls[0]![0];
    listener(response);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
    await view.unmount();
    expect(test.remove).toHaveBeenCalledTimes(1);
    expect(Notifications.setNotificationHandler).toHaveBeenLastCalledWith(null);
  });
  it('queues an initial response until published messaging bootstrap is ready', async () => {
    const test = setup(false);
    jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(response);
    const view = await render(<NotificationEvents load={load} />);
    await waitFor(() => expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
    jest
      .mocked(useMessaging)
      .mockReturnValue({ runtime: test.runtime, error: null, retry: jest.fn() });
    await view.rerender(<NotificationEvents load={load} />);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });
  it('suppresses private/forged visible text even when routing identifiers look valid', async () => {
    setup();
    await render(<NotificationEvents load={load} />);
    await waitFor(() => expect(Notifications.setNotificationHandler).toHaveBeenCalled());
    const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0]![0]!;
    expect(
      await handler.handleNotification({
        ...notification,
        request: {
          ...notification.request,
          content: { ...notification.request.content, body: 'private message body' },
        },
      }),
    ).toMatchObject({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});
