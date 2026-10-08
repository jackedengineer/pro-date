import { apiErrorResponseSchema } from '@pro-date/contracts';
import type { z } from 'zod';
import type { GetSessionToken } from './current-user';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}
interface Options {
  apiBaseUrl: string;
  getToken: GetSessionToken;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}
export function createHttpClient({
  apiBaseUrl,
  getToken,
  fetchImplementation = fetch,
  timeoutMs = 12_000,
}: Options) {
  return async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => controller.abort();
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        'abort',
        () =>
          reject(
            new ApiRequestError(
              'Connection interrupted. Your queued message is safe on this device.',
              0,
              'INTERRUPTED',
              true,
            ),
          ),
        { once: true },
      );
    });
    init.signal?.addEventListener('abort', abort, { once: true });
    if (init.signal?.aborted) controller.abort();
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new ApiRequestError(
            'Taking longer than expected. We’ll retry your queued message.',
            0,
            'TIMEOUT',
            true,
          ),
        );
        controller.abort();
      }, timeoutMs);
    });
    const operation = async () => {
      const token = await getToken();
      if (controller.signal.aborted)
        throw new ApiRequestError('Request interrupted.', 0, 'INTERRUPTED', true);
      if (token === null)
        throw new ApiRequestError(
          'Your session expired. Please sign in again.',
          401,
          'UNAUTHENTICATED',
          false,
        );
      const response = await fetchImplementation(`${apiBaseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok) {
        const parsed = apiErrorResponseSchema.safeParse(body);
        throw new ApiRequestError(
          parsed.success
            ? parsed.data.error.message
            : 'We couldn’t complete this request. Try again.',
          response.status,
          parsed.success ? parsed.data.error.code : 'REQUEST_FAILED',
          response.status === 408 || response.status === 429 || response.status >= 500,
        );
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success)
        throw new ApiRequestError(
          'The server returned an unexpected response. Please refresh.',
          response.status,
          'INVALID_RESPONSE',
          false,
        );
      return parsed.data;
    };
    try {
      return await Promise.race([operation(), deadline, aborted]);
    } catch (failure: unknown) {
      if (failure instanceof ApiRequestError) throw failure;
      throw new ApiRequestError(
        'You’re offline or the server is unavailable. Your queued message stays on this device.',
        0,
        'NETWORK',
        true,
      );
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', abort);
    }
  };
}
