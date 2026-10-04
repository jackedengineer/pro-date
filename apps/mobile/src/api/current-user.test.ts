import { bootstrapCurrentUser, type GetSessionToken } from './current-user';

const apiBaseUrl = 'https://api.prodate.example';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';

describe('bootstrapCurrentUser', () => {
  it('sends the Clerk session as a bearer token and parses the contract', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: '729438da-99b3-4d3d-b566-bfe94401829b',
            onboardingStatus: 'NOT_STARTED',
          },
          requestId,
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );
    const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

    await expect(
      bootstrapCurrentUser({ apiBaseUrl, fetchImplementation, getToken }),
    ).resolves.toEqual({
      id: '729438da-99b3-4d3d-b566-bfe94401829b',
      onboardingStatus: 'NOT_STARTED',
    });

    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me`, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
      },
      method: 'PUT',
    });
  });

  it('fails before making a request when no active session token exists', async () => {
    const fetchImplementation = jest.fn();
    const getToken = jest.fn().mockResolvedValue(null) as GetSessionToken;

    await expect(
      bootstrapCurrentUser({ apiBaseUrl, fetchImplementation, getToken }),
    ).rejects.toThrow('Your session expired. Please sign in again.');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('returns a safe message for an API failure', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
          requestId,
        }),
        { headers: { 'content-type': 'application/json' }, status: 500 },
      ),
    );
    const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

    await expect(
      bootstrapCurrentUser({ apiBaseUrl, fetchImplementation, getToken }),
    ).rejects.toThrow('Something went wrong.');
  });

  it('rejects a successful response that violates the shared contract', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

    await expect(
      bootstrapCurrentUser({ apiBaseUrl, fetchImplementation, getToken }),
    ).rejects.toThrow('The server returned an unexpected response.');
  });
});
