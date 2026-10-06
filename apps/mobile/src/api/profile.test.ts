import {
  saveProfileBirthDate,
  saveProfileDisplayName,
  saveProfileHeight,
  saveProfileIdentity,
  saveProfileLocation,
  saveProfilePreferences,
} from './profile';
import type { GetSessionToken } from './current-user';

const apiBaseUrl = 'https://api.prodate.example';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const emptyProfileDraft = {
  arePronounsVisible: true,
  birthDate: null,
  displayName: null,
  genderIdentity: null,
  hasLocation: false,
  heightCm: null,
  interestedIn: [],
  isGenderVisible: true,
  isHeightVisible: true,
  locationLabel: null,
  onboardingStatus: 'IN_PROGRESS',
  onboardingStep: 'IDENTITY',
  pronouns: null,
  relationshipIntent: null,
} as const;

describe('saveProfileDisplayName', () => {
  it('sends an authenticated profile patch and parses the checkpoint', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...emptyProfileDraft,
            displayName: 'Ada',
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
      ...emptyProfileDraft,
      displayName: 'Ada',
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
            ...emptyProfileDraft,
            birthDate: '2000-02-29',
            displayName: 'Ada',
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
      ...emptyProfileDraft,
      birthDate: '2000-02-29',
      displayName: 'Ada',
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

describe('profile foundation updates', () => {
  it.each([
    {
      body: {
        identity: {
          arePronounsVisible: true,
          genderIdentity: 'Non-binary',
          isGenderVisible: false,
          pronouns: 'they/them',
        },
      },
      checkpoint: {
        ...emptyProfileDraft,
        genderIdentity: 'Non-binary',
        isGenderVisible: false,
        onboardingStep: 'PREFERENCES',
        pronouns: 'they/them',
      },
      save: saveProfileIdentity,
    },
    {
      body: {
        preferences: {
          interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
          relationshipIntent: 'LONG_TERM',
        },
      },
      checkpoint: {
        ...emptyProfileDraft,
        interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
        onboardingStep: 'LOCATION',
        relationshipIntent: 'LONG_TERM',
      },
      save: saveProfilePreferences,
    },
    {
      body: {
        location: {
          countryCode: 'IN',
          latitude: 19.076,
          locality: 'Mumbai',
          longitude: 72.8777,
          region: 'Maharashtra',
        },
      },
      checkpoint: {
        ...emptyProfileDraft,
        hasLocation: true,
        locationLabel: 'Mumbai, Maharashtra',
        onboardingStep: 'DETAILS',
      },
      save: saveProfileLocation,
    },
    {
      body: { height: { centimeters: 173, isVisible: true } },
      checkpoint: {
        ...emptyProfileDraft,
        heightCm: 173,
        onboardingStep: 'PHOTOS',
      },
      save: saveProfileHeight,
    },
  ] as const)('sends and validates the $checkpoint.onboardingStep update', async (testCase) => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: testCase.checkpoint, requestId }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

    await expect(
      testCase.save({
        apiBaseUrl,
        fetchImplementation,
        getToken,
        ...testCase.body[Object.keys(testCase.body)[0] as keyof typeof testCase.body],
      } as never),
    ).resolves.toEqual(testCase.checkpoint);

    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile`, {
      body: JSON.stringify(testCase.body),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    });
  });
});
