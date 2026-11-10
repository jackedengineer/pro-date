import { accountDeletionResponseSchema, apiErrorResponseSchema } from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';

/** Deletion removes images and the sign-in as well as data, so it is allowed longer than a read. */
export const ACCOUNT_DELETION_TIMEOUT_MS = 45_000;

interface DeleteAccountOptions {
  apiBaseUrl: string;
  fetchImplementation?: typeof fetch;
  getToken: GetSessionToken;
}

/** Permanently deletes the signed-in member's account. Resolves with what the server removed. */
export async function deleteAccount({
  apiBaseUrl,
  fetchImplementation = fetch,
  getToken,
}: DeleteAccountOptions): Promise<{ signInRemoved: boolean }> {
  const token = await getToken();
  if (token === null) throw new Error('Your session expired. Sign in again.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACCOUNT_DELETION_TIMEOUT_MS);
  try {
    const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      method: 'DELETE',
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const failure = apiErrorResponseSchema.safeParse(body);
      throw new Error(
        failure.success ? failure.data.error.message : 'Couldn’t delete your account. Try again.',
      );
    }

    const parsed = accountDeletionResponseSchema.safeParse(body);
    if (!parsed.success) throw new Error('The server returned an unexpected response.');
    return { signInRemoved: parsed.data.data.signInRemoved };
  } catch (failure: unknown) {
    if (controller.signal.aborted)
      throw new Error('That took too long. Check your connection and try again.');
    throw failure;
  } finally {
    clearTimeout(timer);
  }
}
