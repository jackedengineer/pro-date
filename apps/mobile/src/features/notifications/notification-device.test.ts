import { createNotificationDevice, type NativeNotifications } from './notification-device';

const projectId = '10000000-0000-4000-8000-000000000001';
function setup(platform = 'ios', isExpoGo = false, project: unknown = projectId) {
  const sdk = {
    getPermissionsAsync: jest.fn().mockResolvedValue({
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
    }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({
      granted: true,
      status: 'granted',
      canAskAgain: true,
    }),
    setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExpoPushToken[test-token]' }),
    addPushTokenListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    AndroidImportance: { DEFAULT: 3 },
    AndroidNotificationVisibility: { PRIVATE: 0 },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    PermissionStatus: { DENIED: 'denied' },
  };
  const load = jest
    .fn<Promise<NativeNotifications>, []>()
    .mockResolvedValue(sdk as unknown as NativeNotifications);
  return {
    sdk,
    load,
    device: createNotificationDevice({ platform, isExpoGo, projectId: project, load }),
  };
}
describe('contextual native notification registration', () => {
  it.each([
    ['android', true, projectId],
    ['ios', true, projectId],
    ['web', false, projectId],
    ['ios', false, 'invalid'],
  ])(
    'does not even load unsupported native APIs (%s, Expo Go %s)',
    async (platform, go, project) => {
      const { device, load } = setup(platform, go, project);
      expect(await device.prepare(true)).toEqual({ status: 'SETUP_PENDING' });
      expect(load).not.toHaveBeenCalled();
    },
  );
  it('foreground checks do not request permission or collect a token without permission', async () => {
    const { device, sdk } = setup();
    expect(await device.prepare(false)).toEqual({ status: 'PERMISSION_REQUIRED' });
    expect(sdk.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(sdk.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
  it('creates the Android channel before the explicit OS prompt and uses an explicit project', async () => {
    const { device, sdk } = setup('android');
    expect(await device.prepare(true)).toEqual({
      status: 'READY',
      registration: { token: 'ExpoPushToken[test-token]', platform: 'android', projectId },
    });
    expect(sdk.setNotificationChannelAsync).toHaveBeenCalledWith(
      'messages',
      expect.objectContaining({ name: 'Selected chats', sound: 'default' }),
    );
    expect(sdk.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.requestPermissionsAsync.mock.invocationCallOrder[0]!,
    );
    expect(sdk.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId });
  });
  it('does not prompt again after denial, even when the OS says it can ask again', async () => {
    const { device, sdk } = setup();
    sdk.getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
      canAskAgain: true,
    });
    expect(await device.prepare(true)).toEqual({ status: 'DENIED' });
    expect(sdk.requestPermissionsAsync).not.toHaveBeenCalled();
  });
  it('accepts provisional iOS permission without requesting a more intrusive grant', async () => {
    const { device, sdk } = setup();
    sdk.getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'granted',
      canAskAgain: false,
      ios: { status: 3 },
    });
    expect(await device.prepare(true)).toMatchObject({ status: 'READY' });
    expect(sdk.requestPermissionsAsync).not.toHaveBeenCalled();
  });
  it('does not advance an old account after a delayed permission result', async () => {
    const { device, sdk } = setup();
    let current = true;
    sdk.getPermissionsAsync.mockImplementation(() => {
      current = false;
      return Promise.resolve({ granted: false, status: 'undetermined', canAskAgain: true });
    });
    await expect(device.prepare(true, () => current)).rejects.toThrow('session changed');
    expect(sdk.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(sdk.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
  it('rejects malformed provider tokens without surfacing native error details', async () => {
    const { device, sdk } = setup();
    sdk.getExpoPushTokenAsync.mockResolvedValue({ data: 'private-invalid-value' });
    expect(await device.prepare(true)).toEqual({ status: 'UNAVAILABLE' });
  });
  it('bounds a hung token lookup and shares it rather than creating unlimited requests', async () => {
    jest.useFakeTimers();
    try {
      const { device, sdk } = setup();
      sdk.getPermissionsAsync.mockResolvedValue({
        granted: true,
        status: 'granted',
        canAskAgain: true,
      });
      sdk.getExpoPushTokenAsync.mockReturnValue(new Promise(() => {}));
      const pending = device.prepare(false);
      await jest.advanceTimersByTimeAsync(15_000);
      expect(await pending).toEqual({ status: 'UNAVAILABLE' });
      const retry = device.prepare(false);
      await jest.advanceTimersByTimeAsync(15_000);
      expect(await retry).toEqual({ status: 'UNAVAILABLE' });
      expect(sdk.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
  it('passes a rotated native token through without asking the SDK for a native token again', async () => {
    const { device, sdk } = setup();
    const nativeToken = { type: 'ios' as const, data: 'native-token' };
    await device.prepare(true, () => true, nativeToken);
    expect(sdk.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId,
      devicePushToken: nativeToken,
    });
  });
});
