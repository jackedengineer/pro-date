import {
  apiErrorResponseSchema,
  profileResponseSchema,
  type ProfileResponse,
} from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';

interface SaveProfileDisplayNameOptions {
  apiBaseUrl: string;
  displayName: string;
  fetchImplementation?: typeof fetch;
  getToken: GetSessionToken;
}

export type ProfileCheckpoint = ProfileResponse['data'];

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function saveProfileDisplayName({
  apiBaseUrl,
  displayName,
  fetchImplementation = fetch,
  getToken,
}: SaveProfileDisplayNameOptions): Promise<ProfileCheckpoint> {
  const token = await getToken();

  if (token === null) {
    throw new Error('Your session expired. Please sign in again.');
  }

  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me/profile`, {
    body: JSON.stringify({ displayName }),
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
