import { saveProfileBirthDate, saveProfileDisplayName } from './profile';
import type { GetSessionToken } from './current-user';

const apiBaseUrl = 'https://api.prodate.example';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';

describe('saveProfileDisplayName', () => {
  it('sends an authenticated profile patch and parses the checkpoint', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            birthDate: null,
            displayName: 'Ada',
            onboardingStatus: 'IN_PROGRESS',
            onboardingStep: 'BIRTHDAY',
          },
          requestId,
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );
    const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

    await expect(
      saveProfileDisplayName({
        apiBaseUrl,
        displayName: 'Ada',
        fetchImplementation,
        getToken,
      }),
    ).resolves.toEqual({
      birthDate: null,
      displayName: 'Ada',
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'BIRTHDAY',
    });

    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile`, {
      body: JSON.stringify({ displayName: 'Ada' }),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    });
  });

  it('fails before making a request when the session has expired', async () => {
    const fetchImplementation = jest.fn();
    const getToken = jest.fn().mockResolvedValue(null) as GetSessionToken;

    await expect(
      saveProfileDisplayName({
        apiBaseUrl,
        displayName: 'Ada',
        fetchImplementation,
        getToken,
      }),
    ).rejects.toThrow('Your session expired. Please sign in again.');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('uses the safe API message when persistence fails', async () => {
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
      saveProfileDisplayName({
        apiBaseUrl,
        displayName: 'Ada',
        fetchImplementation,
        getToken,
      }),
    ).rejects.toThrow('Something went wrong.');
  });

  it('rejects a successful response that violates the profile contract', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

    await expect(
      saveProfileDisplayName({
        apiBaseUrl,
        displayName: 'Ada',
        fetchImplementation,
        getToken,
      }),
    ).rejects.toThrow('The server returned an unexpected response.');
  });
});

describe('saveProfileBirthDate', () => {
  it('sends an authenticated calendar-date patch and parses the complete draft', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            birthDate: '2000-02-29',
            displayName: 'Ada',
            onboardingStatus: 'IN_PROGRESS',
            onboardingStep: 'IDENTITY',
          },
          requestId,
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );
    const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

    await expect(
      saveProfileBirthDate({
        apiBaseUrl,
        birthDate: '2000-02-29',
        fetchImplementation,
        getToken,
      }),
    ).resolves.toEqual({
      birthDate: '2000-02-29',
      displayName: 'Ada',
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'IDENTITY',
    });

    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile`, {
      body: JSON.stringify({ birthDate: '2000-02-29' }),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    });
  });
});
