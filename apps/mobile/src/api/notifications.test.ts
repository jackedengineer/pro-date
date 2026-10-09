import { createNotificationsApi } from './notifications';
const id = '10000000-0000-4000-8000-000000000001';
describe('notification settings client', () => {
  it('never describes failed preference changes as queued or safely persisted', async () => {
    const api = createNotificationsApi({
      apiBaseUrl: 'https://api.example.test',
      getToken: () => Promise.resolve('test'),
      fetchImplementation: jest.fn().mockRejectedValue(new Error('Offline')),
    });
    await expect(api.saveSettings(true)).rejects.toThrow(
      'Couldn’t confirm this setting. Go online and refresh before retrying.',
    );
  });
  it('uses authenticated desired-state requests and validates server readiness', async () => {
    const fetchImplementation = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { isPaused: true, revision: 1, isAvailable: true, isDeliveryReady: false },
            requestId: id,
          }),
        ),
      );
    const api = createNotificationsApi({
      apiBaseUrl: 'https://api.example.test',
      getToken: () => Promise.resolve('test-token'),
      fetchImplementation,
    });
    await expect(api.saveSettings(true)).resolves.toMatchObject({
      isPaused: true,
      isDeliveryReady: false,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example.test/v1/notification-settings',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isPaused: true }),
      }),
    );
    expect(fetchImplementation.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    });
  });
  it('does not fetch with an expired session or accept an unvalidated response', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { isEnabled: 'yes', token: 'private' }, requestId: id }),
        ),
      );
    const input = { apiBaseUrl: 'https://api.example.test', fetchImplementation };
    const expired = createNotificationsApi({ ...input, getToken: () => Promise.resolve(null) });
    await expect(expired.settings()).rejects.toThrow('session expired');
    expect(fetchImplementation).not.toHaveBeenCalled();
    const api = createNotificationsApi({ ...input, getToken: () => Promise.resolve('test') });
    await expect(api.conversation(id)).rejects.toThrow('unexpected response');
  });
});
