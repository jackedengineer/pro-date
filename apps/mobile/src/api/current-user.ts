import {
  apiErrorResponseSchema,
  currentUserResponseSchema,
  type CurrentUserResponse,
} from '@pro-date/contracts';

export type GetSessionToken = () => Promise<string | null>;

interface BootstrapCurrentUserOptions {
  apiBaseUrl: string;
  fetchImplementation?: typeof fetch;
  getToken: GetSessionToken;
}

export type CurrentUser = CurrentUserResponse['data'];

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function bootstrapCurrentUser({
  apiBaseUrl,
  fetchImplementation = fetch,
  getToken,
}: BootstrapCurrentUserOptions): Promise<CurrentUser> {
  const token = await getToken();

  if (token === null) {
    throw new Error('Your session expired. Please sign in again.');
  }

  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    method: 'PUT',
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    const apiError = apiErrorResponseSchema.safeParse(responseBody);

    throw new Error(
      apiError.success
        ? apiError.data.error.message
        : 'We could not prepare your profile. Please try again.',
    );
  }

  const currentUserResponse = currentUserResponseSchema.safeParse(responseBody);

  if (!currentUserResponse.success) {
    throw new Error('The server returned an unexpected response.');
  }

  return currentUserResponse.data.data;
}
