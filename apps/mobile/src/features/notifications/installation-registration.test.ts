import { createInstallationRegistration } from './installation-registration';
import type { NotificationDeviceReceipt } from '@pro-date/contracts';
const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const installation = '10000000-0000-4000-8000-000000000003';
const operation = '10000000-0000-4000-8000-000000000004';
const desired = { token: 'ExpoPushToken[test-token]', platform: 'ios' as const, projectId: other };
const receipt: NotificationDeviceReceipt = {
  installationId: installation,
  version: 1,
  isRegistered: true,
};
jest.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1 }));
jest.mock('expo-crypto', () => ({}));
function setup() {
  let stored: string | null = null;
  let current: string | null = owner;
  const read = jest.fn(() => Promise.resolve(stored));
  const write = jest.fn((value: string) => {
    stored = value;
    return Promise.resolve();
  });
  const register = jest
    .fn<Promise<NotificationDeviceReceipt>, [string, unknown, AbortSignal?]>()
    .mockResolvedValue(receipt);
  const revoke = jest
    .fn<Promise<NotificationDeviceReceipt>, [string, unknown, AbortSignal?]>()
    .mockResolvedValue({ ...receipt, version: 2, isRegistered: false });
  let uuids = 0;
  const uuid = jest.fn(() =>
    ++uuids === 1 ? installation : `10000000-0000-4000-8000-${String(uuids + 2).padStart(12, '0')}`,
  );
  const ports = {
    read,
    write,
    uuid,
    randomBytes: () => Promise.resolve(new Uint8Array(32).fill(17)),
    currentOwner: () => current,
    api: () => ({ register, revoke }),
    now: () => 1000,
  };
  return {
    ports,
    register,
    revoke,
    write,
    read,
    getStored: () => stored,
    setOwner: (value: string | null) => {
      current = value;
    },
    setStored: (value: string) => {
      stored = value;
    },
  };
}
describe('secure installation operations', () => {
  it('rejects a session switch during cached revocation lookup', async () => {
    const test = setup();
    const registration = createInstallationRegistration(test.ports);
    await registration.register(owner, desired);
    await registration.revoke(owner);
    test.read.mockImplementation(() => {
      test.setOwner(other);
      return Promise.resolve(test.getStored());
    });
    await expect(registration.revoke(owner)).rejects.toThrow('session changed');
    expect(test.revoke).toHaveBeenCalledTimes(1);
  });
  it('does not acknowledge an inconsistent revocation response', async () => {
    const test = setup();
    const registration = createInstallationRegistration(test.ports);
    await registration.register(owner, desired);
    test.revoke.mockResolvedValue({ ...receipt, version: 2, isRegistered: true });
    await expect(registration.revoke(owner)).rejects.toThrow('registration version');
    expect(JSON.parse(test.getStored()!) as unknown).toMatchObject({
      version: 1,
      pending: { action: 'REVOKE' },
    });
  });
  it('persists a 256-bit binding and stable operation before remote registration', async () => {
    const test = setup();
    test.register.mockImplementation(() => {
      expect(test.getStored()).toContain(operation);
      expect(test.getStored()).toContain('11'.repeat(32));
      return Promise.resolve(receipt);
    });
    await expect(
      createInstallationRegistration(test.ports).register(owner, desired),
    ).resolves.toEqual(receipt);
    expect(test.register.mock.calls[0]?.[1]).toEqual({
      ...desired,
      bindingSecret: '11'.repeat(32),
      expectedVersion: 0,
      operationId: operation,
    });
    expect(JSON.parse(test.getStored()!) as unknown).toMatchObject({
      version: 1,
      pending: null,
      ownerId: owner,
    });
  });
  it('reuses the exact persisted operation after a timeout and process restart', async () => {
    const test = setup();
    test.register.mockRejectedValueOnce(new Error('Timed out'));
    await expect(
      createInstallationRegistration(test.ports).register(owner, desired),
    ).rejects.toThrow('Timed out');
    const firstBody = test.register.mock.calls[0]?.[1];
    await createInstallationRegistration(test.ports).register(owner, desired);
    expect(test.register.mock.calls[1]?.[1]).toEqual(firstBody);
    expect(test.ports.uuid).toHaveBeenCalledTimes(2);
  });
  it('does not send or bind if secure persistence fails', async () => {
    const test = setup();
    test.write.mockRejectedValueOnce(new Error('Keychain locked'));
    await expect(
      createInstallationRegistration(test.ports).register(owner, desired),
    ).rejects.toThrow('Keychain locked');
    expect(test.register).not.toHaveBeenCalled();
  });
  it('recovers the same request if acknowledgement persistence fails', async () => {
    const test = setup();
    test.write
      .mockImplementationOnce((value) => Promise.resolve(test.setStored(value)))
      .mockImplementationOnce((value) => Promise.resolve(test.setStored(value)))
      .mockRejectedValueOnce(new Error('Keychain locked'));
    const registration = createInstallationRegistration(test.ports);
    await expect(registration.register(owner, desired)).rejects.toThrow('Keychain locked');
    await registration.register(owner, desired);
    expect(test.register.mock.calls[1]?.[1]).toEqual(test.register.mock.calls[0]?.[1]);
  });
  it('never retries an unknown previous-owner operation with another account’s credentials', async () => {
    const test = setup();
    test.register.mockRejectedValueOnce(new Error('Unknown'));
    const registration = createInstallationRegistration(test.ports);
    await expect(registration.register(owner, desired)).rejects.toThrow('Unknown');
    test.setOwner(other);
    await expect(registration.register(other, desired)).rejects.toThrow('previous account');
    expect(test.register).toHaveBeenCalledTimes(1);
  });
  it('saves a late acknowledgement for CAS but never reports success to the old session', async () => {
    const test = setup();
    test.register.mockImplementation(() => {
      test.setOwner(other);
      return Promise.resolve(receipt);
    });
    const registration = createInstallationRegistration(test.ports);
    await expect(registration.register(owner, desired)).rejects.toThrow('session changed');
    expect(JSON.parse(test.getStored()!) as unknown).toMatchObject({ version: 1, pending: null });
    test.register.mockResolvedValue({ ...receipt, version: 2 });
    await registration.register(other, desired);
    expect(test.register.mock.calls[1]?.[1]).toMatchObject({ expectedVersion: 1 });
  });
  it('serializes registrations and avoids unchanged renewals within a day', async () => {
    const test = setup();
    const registration = createInstallationRegistration(test.ports);
    await Promise.all([
      registration.register(owner, desired),
      registration.register(owner, desired),
    ]);
    expect(test.register).toHaveBeenCalledTimes(1);
    await createInstallationRegistration(test.ports).register(owner, desired);
    expect(test.register).toHaveBeenCalledTimes(1);
    test.register.mockResolvedValue({ ...receipt, version: 2 });
    await createInstallationRegistration({ ...test.ports, now: () => 86402000 }).register(
      owner,
      desired,
    );
    expect(test.register).toHaveBeenCalledTimes(2);
  });
  it('rejects corrupted storage instead of silently abandoning the binding', async () => {
    const test = setup();
    test.setStored('{bad');
    await expect(
      createInstallationRegistration(test.ports).register(owner, desired),
    ).rejects.toThrow('registration storage');
    expect(test.register).not.toHaveBeenCalled();
    expect(test.ports.uuid).not.toHaveBeenCalled();
  });
  it('settles an unknown registration before revocation, without losing its version', async () => {
    const test = setup();
    const registration = createInstallationRegistration(test.ports);
    test.register.mockRejectedValueOnce(new Error('Unknown'));
    await expect(registration.register(owner, desired)).rejects.toThrow('Unknown');
    await expect(registration.revoke(owner)).resolves.toMatchObject({
      version: 2,
      isRegistered: false,
    });
    expect(test.revoke.mock.calls[0]?.[1]).toMatchObject({ expectedVersion: 1 });
    expect(test.getStored()).not.toContain(desired.token);
  });
  it('does nothing on sign-out when this installation was never registered', async () => {
    const test = setup();
    await expect(createInstallationRegistration(test.ports).revoke(owner)).resolves.toBeNull();
    expect(test.register).not.toHaveBeenCalled();
    expect(test.revoke).not.toHaveBeenCalled();
    expect(test.write).not.toHaveBeenCalled();
  });
  it('keeps an unconfirmed revocation for safe retry without claiming it succeeded', async () => {
    const test = setup();
    const registration = createInstallationRegistration(test.ports);
    await registration.register(owner, desired);
    test.revoke.mockRejectedValueOnce(new Error('Offline'));
    await expect(registration.revoke(owner)).rejects.toThrow('Offline');
    await registration.revoke(owner);
    expect(test.revoke.mock.calls[1]?.[1]).toEqual(test.revoke.mock.calls[0]?.[1]);
  });
});
