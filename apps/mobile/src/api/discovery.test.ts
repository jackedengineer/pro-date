import { createDiscoveryApi } from './discovery';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
describe('discovery API client', () => {
  it('authenticates and validates paginated responses', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [], nextCursor: null, requestId })));
    const api = createDiscoveryApi({
      apiBaseUrl: 'https://api.prodate.example',
      getToken: () => Promise.resolve('session-test'),
      fetchImplementation,
    });
    await expect(api.browse({ radiusKm: 25, minAge: 18, maxAge: 99 })).resolves.toEqual({
      data: [],
      nextCursor: null,
      requestId,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringContaining('/v1/discovery?'),
      expect.objectContaining({}),
    );
  });
  it('does not fetch with an expired session or accept malformed server data', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ latitude: 12 }], nextCursor: null, requestId })),
      );
    const api = createDiscoveryApi({
      apiBaseUrl: 'https://api.prodate.example',
      getToken: () => Promise.resolve(null),
      fetchImplementation,
    });
    await expect(api.inbox()).rejects.toThrow('session expired');
    expect(fetchImplementation).not.toHaveBeenCalled();
    const authenticated = createDiscoveryApi({
      apiBaseUrl: 'https://api.prodate.example',
      getToken: () => Promise.resolve('session-test'),
      fetchImplementation,
    });
    await expect(authenticated.inbox()).rejects.toThrow('unexpected response');
  });
});
