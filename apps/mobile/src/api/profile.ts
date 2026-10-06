import {
  apiErrorResponseSchema,
  profileResponseSchema,
  type ProfileResponse,
} from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';

interface SaveProfileOptions {
  apiBaseUrl: string;
  fetchImplementation?: typeof fetch;
  getToken: GetSessionToken;
}

interface SaveProfileBirthDateOptions extends SaveProfileOptions {
  birthDate: string;
}

interface SaveProfileDisplayNameOptions extends SaveProfileOptions {
  displayName: string;
}

type ProfileUpdate = { birthDate: string } | { displayName: string };

export type ProfileCheckpoint = ProfileResponse['data'];

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function saveProfileUpdate({
  apiBaseUrl,
  body,
  fetchImplementation = fetch,
  getToken,
}: SaveProfileOptions & { body: ProfileUpdate }): Promise<ProfileCheckpoint> {
  const token = await getToken();

  if (token === null) {
    throw new Error('Your session expired. Please sign in again.');
  }

  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me/profile`, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    const apiError = apiErrorResponseSchema.safeParse(responseBody);

    throw new Error(
      apiError.success
        ? apiError.data.error.message
        : 'We could not save your profile. Please try again.',
    );
  }

  const profileResponse = profileResponseSchema.safeParse(responseBody);

  if (!profileResponse.success) {
    throw new Error('The server returned an unexpected response.');
  }

  return profileResponse.data.data;
}

export function saveProfileBirthDate({
  birthDate,
  ...options
}: SaveProfileBirthDateOptions): Promise<ProfileCheckpoint> {
  return saveProfileUpdate({ ...options, body: { birthDate } });
}

export function saveProfileDisplayName({
  displayName,
  ...options
}: SaveProfileDisplayNameOptions): Promise<ProfileCheckpoint> {
  return saveProfileUpdate({ ...options, body: { displayName } });
}
