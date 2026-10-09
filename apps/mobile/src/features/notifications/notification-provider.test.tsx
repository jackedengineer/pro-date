import { cleanup, render, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { useMessaging, type MessagingRuntime } from '../messaging/messaging-provider';
import { NotificationProvider, useNotificationDevice } from './notification-provider';
import { notificationDevice } from './notification-device';
import { createSecureInstallationRegistration } from './installation-registration';
import { StrictMode } from 'react';

jest.mock('../messaging/messaging-provider', () => ({ useMessaging: jest.fn() }));
jest.mock('./notification-device', () => ({
  notificationDevice: { supported: true, prepare: jest.fn(), listenTokens: jest.fn() },
}));
jest.mock('./installation-registration', () => ({
  createSecureInstallationRegistration: jest.fn(),
}));
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
const owner = '10000000-0000-4000-8000-000000000001';
function Status() {
  return <Text>{useNotificationDevice().status}</Text>;
}
function setup() {
  const revoke = jest.fn().mockResolvedValue(null);
  const register = jest.fn().mockResolvedValue({ isRegistered: true });
  jest
    .mocked(createSecureInstallationRegistration)
    .mockReturnValue({ hasConsent: jest.fn().mockResolvedValue(true), register, revoke });
  jest.mocked(notificationDevice.prepare).mockResolvedValue({
    status: 'READY',
    registration: { token: 'ExpoPushToken[test]', platform: 'ios', projectId: owner },
  });
  const removeToken = jest.fn();
  jest.mocked(notificationDevice.listenTokens).mockResolvedValue(removeToken);
  const settings = jest.fn().mockResolvedValue({ isAvailable: true, isDeliveryReady: true });
  const runtime = {
    ownerId: owner,
    isCurrent: () => true,
    notifications: { settings },
    notificationDevices: {},
  } as unknown as MessagingRuntime;
  jest.mocked(useMessaging).mockReturnValue({ runtime, error: null, retry: jest.fn() });
  return { register, revoke, settings, removeToken };
}
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
describe('notification provider wiring', () => {
  it('survives React Strict Mode effect replay', async () => {
    setup();
    const view = await render(
      <StrictMode>
        <NotificationProvider>
          <Status />
        </NotificationProvider>
      </StrictMode>,
    );
    expect(await view.findByText('READY')).toBeTruthy();
  });
  it('cleans foreground/token listeners and clears readiness on an account transition', async () => {
    const test = setup();
    const removeApp = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: removeApp });
    const view = await render(
      <NotificationProvider>
        <Status />
      </NotificationProvider>,
    );
    expect(await view.findByText('READY')).toBeTruthy();
    jest.mocked(useMessaging).mockReturnValue({ runtime: null, error: null, retry: jest.fn() });
    await view.rerender(
      <NotificationProvider>
        <Status />
      </NotificationProvider>,
    );
    expect(view.getByText('SETUP_PENDING')).toBeTruthy();
    expect(test.removeToken).toHaveBeenCalledTimes(1);
    expect(removeApp).toHaveBeenCalledTimes(1);
    expect(test.revoke).not.toHaveBeenCalled(); // No old-owner request with new credentials.
  });
  it('removes a late-created native listener after unmount', async () => {
    setup();
    let resolve: (remove: () => void) => void = () => {};
    jest.mocked(notificationDevice.listenTokens).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = await render(
      <NotificationProvider>
        <Status />
      </NotificationProvider>,
    );
    await waitFor(() => expect(notificationDevice.listenTokens).toHaveBeenCalled());
    await view.unmount();
    const remove = jest.fn();
    resolve(remove);
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  });
});
