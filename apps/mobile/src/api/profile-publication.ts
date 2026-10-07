import {
  apiErrorResponseSchema,
  profileReviewResponseSchema,
  type ProfileReview,
} from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';

interface ProfilePublicationApiOptions {
  apiBaseUrl: string;
  fetchImplementation?: typeof fetch;
  getToken: GetSessionToken;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function requestProfileReview(
  path: 'profile-review' | 'profile-publication',
  method: 'GET' | 'PUT',
  { apiBaseUrl, fetchImplementation = fetch, getToken }: ProfilePublicationApiOptions,
): Promise<ProfileReview> {
  const token = await getToken();

  if (token === null) throw new Error('Your session expired. Please sign in again.');

  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me/${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    method,
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    const parsed = apiErrorResponseSchema.safeParse(responseBody);

    throw new Error(
      parsed.success
        ? parsed.data.error.message
        : 'We could not prepare your profile review. Please try again.',
    );
  }

  const parsed = profileReviewResponseSchema.safeParse(responseBody);

  if (!parsed.success) throw new Error('The server returned an unexpected profile response.');

  return parsed.data.data;
}

export function loadProfileReview(options: ProfilePublicationApiOptions): Promise<ProfileReview> {
  return requestProfileReview('profile-review', 'GET', options);
}

export function publishProfile(options: ProfilePublicationApiOptions): Promise<ProfileReview> {
  return requestProfileReview('profile-publication', 'PUT', options);
}
