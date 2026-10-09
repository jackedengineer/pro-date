import { createNotificationDevicesApi } from './notification-devices';
const id = '10000000-0000-4000-8000-000000000001';
const registration = {
  bindingSecret: 'a'.repeat(64),
  expectedVersion: 0,
  operationId: id,
  token: 'ExpoPushToken[test-token]',
  platform: 'ios' as const,
  projectId: id,
};
describe('owner-bound device client', () => {
  it('uses write-only authenticated requests and preserves the stable operation', async () => {
    const fetchImplementation = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: { installationId: id, version: 1, isRegistered: true },
              requestId: id,
            }),
          ),
        ),
      );
    const api = createNotificationDevicesApi({
      apiBaseUrl: 'https://api.example.test',
      getToken: () => Promise.resolve('test'),
      ownerId: id,
      currentOwner: () => id,
      fetchImplementation,
    });
    await expect(api.register(id, registration)).resolves.toEqual({
      installationId: id,
      version: 1,
      isRegistered: true,
    });
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      `https://api.example.test/v1/notification-devices/${id}`,
    );
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(registration));
    expect(fetchImplementation.mock.calls[0]?.[1]?.method).toBe('PUT');
    const { bindingSecret, operationId } = registration;
    await api.revoke(id, { bindingSecret, operationId, expectedVersion: 1 });
    expect(fetchImplementation.mock.calls[1]?.[1]?.method).toBe('DELETE');
  });
  it('does not fetch if the account changes while waiting for a session token', async () => {
    let current: string | null = id;
    const fetchImplementation = jest.fn();
    const api = createNotificationDevicesApi({
      apiBaseUrl: 'https://api.example.test',
      ownerId: id,
      currentOwner: () => current,
      getToken: () => {
        current = null;
        return Promise.resolve('test');
      },
      fetchImplementation,
    });
    await expect(api.register(id, registration)).rejects.toThrow('session changed');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
  it('never describes an unknown registration outcome as a queued message', async () => {
    const api = createNotificationDevicesApi({
      apiBaseUrl: 'https://api.example.test',
      ownerId: id,
      currentOwner: () => id,
      getToken: () => Promise.resolve('test'),
      fetchImplementation: jest.fn().mockRejectedValue(new Error('Offline')),
    });
    await expect(api.register(id, registration)).rejects.toThrow(
      'Couldn’t confirm this device change',
    );
  });
  it('rejects responses containing a token or proof instead of a minimized receipt', async () => {
    const api = createNotificationDevicesApi({
      apiBaseUrl: 'https://api.example.test',
      ownerId: id,
      currentOwner: () => id,
      getToken: () => Promise.resolve('test'),
      fetchImplementation: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { installationId: id, version: 1, isRegistered: true, token: 'private' },
            requestId: id,
          }),
        ),
      ),
    });
    await expect(api.register(id, registration)).rejects.toThrow('unexpected response');
  });
});
