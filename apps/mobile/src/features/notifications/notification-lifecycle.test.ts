import { NotificationLifecycle } from './notification-lifecycle';
import type { NotificationDevice } from './notification-device';

const owner = '10000000-0000-4000-8000-000000000001';
const registration = {
  token: 'ExpoPushToken[test-token]',
  platform: 'ios' as const,
  projectId: owner,
};
function setup() {
  let current: string | null = owner;
  const settings = jest.fn().mockResolvedValue({ isAvailable: true, isDeliveryReady: true });
  const prepare = jest.fn().mockResolvedValue({ status: 'READY', registration });
  const register = jest.fn().mockResolvedValue({ isRegistered: true });
  const revoke = jest.fn().mockResolvedValue({ isRegistered: false });
  const hasConsent = jest.fn().mockResolvedValue(false);
  const lifecycle = new NotificationLifecycle({
    ownerId: owner,
    currentOwner: () => current,
    settings,
    device: { supported: true, prepare } as unknown as NotificationDevice,
    registration: { register, revoke, hasConsent },
  });
  return {
    lifecycle,
    settings,
    prepare,
    register,
    revoke,
    hasConsent,
    setOwner: (value: string | null) => {
      current = value;
    },
  };
}
describe('account-scoped notification lifecycle', () => {
  it('bounds sign-out cleanup even when a native operation never settles', async () => {
    jest.useFakeTimers();
    try {
      const test = setup();
      test.prepare.mockReturnValue(new Promise(() => {}));
      void test.lifecycle.enable();
      await jest.advanceTimersByTimeAsync(0);
      const cleanup = test.lifecycle.beforeSignOut();
      await jest.advanceTimersByTimeAsync(3_000);
      let settled = false;
      void cleanup.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(true);
      expect(await cleanup).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
  it('does not invoke native permission or token APIs while backend setup is pending', async () => {
    const test = setup();
    test.settings.mockResolvedValue({ isAvailable: true, isDeliveryReady: false });
    expect(await test.lifecycle.enable()).toBe('SETUP_PENDING');
    expect(test.prepare).not.toHaveBeenCalled();
    expect(test.register).not.toHaveBeenCalled();
  });
  it('does not infer consent from a foreground event or another account', async () => {
    const test = setup();
    expect(await test.lifecycle.refresh()).toBe('PERMISSION_REQUIRED');
    expect(test.prepare).not.toHaveBeenCalled();
    expect(test.register).not.toHaveBeenCalled();
  });
  it('registers only after an explicit action and requires an acknowledged registration', async () => {
    const test = setup();
    expect(await test.lifecycle.enable()).toBe('READY');
    expect(test.prepare).toHaveBeenCalledWith(true, expect.any(Function), undefined);
    expect(test.register).toHaveBeenCalledWith(owner, registration);
    test.register.mockResolvedValue({ isRegistered: false });
    expect(await test.lifecycle.enable()).toBe('UNAVAILABLE');
  });
  it('does not block messaging or advertise readiness after a provider/storage/API failure', async () => {
    const test = setup();
    test.register.mockRejectedValue(new Error('Sensitive native detail'));
    expect(await test.lifecycle.enable()).toBe('UNAVAILABLE');
    expect(test.lifecycle.getSnapshot()).toBe('UNAVAILABLE');
  });
  it('revokes a consented registration when foreground permission is denied, without prompting', async () => {
    const test = setup();
    test.hasConsent.mockResolvedValue(true);
    test.prepare.mockResolvedValue({ status: 'DENIED' });
    expect(await test.lifecycle.refresh()).toBe('DENIED');
    expect(test.prepare).toHaveBeenCalledWith(false, expect.any(Function), undefined);
    expect(test.revoke).toHaveBeenCalledWith(owner);
  });
  it('does not start an old-account registration after a delayed token lookup', async () => {
    const test = setup();
    test.prepare.mockImplementation(() => {
      test.setOwner(null);
      return Promise.resolve({ status: 'READY', registration });
    });
    expect(await test.lifecycle.enable()).toBe('UNAVAILABLE');
    expect(test.register).not.toHaveBeenCalled();
    expect(test.lifecycle.getSnapshot()).not.toBe('READY');
  });
  it('does not publish late success after disposal', async () => {
    const test = setup();
    test.register.mockImplementation(() => {
      test.lifecycle.dispose();
      return Promise.resolve({ isRegistered: true });
    });
    expect(await test.lifecycle.enable()).toBe('UNAVAILABLE');
    expect(test.lifecycle.getSnapshot()).not.toBe('READY');
  });
  it('best-effort sign-out revocation does not claim success offline and prevents renewal', async () => {
    const test = setup();
    test.revoke.mockRejectedValue(new Error('Offline'));
    expect(await test.lifecycle.beforeSignOut()).toBe(false);
    expect(await test.lifecycle.refresh()).toBe('UNAVAILABLE');
    expect(test.register).not.toHaveBeenCalled();
  });
  it('coalesces foreground checks while a registration is in progress', async () => {
    const test = setup();
    test.hasConsent.mockResolvedValue(true);
    const first = test.lifecycle.refresh();
    const second = test.lifecycle.refresh();
    expect(await first).toBe('READY');
    expect(await second).toBe('READY');
    expect(test.register).toHaveBeenCalledTimes(1);
  });
});
