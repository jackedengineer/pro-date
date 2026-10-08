import { z } from 'zod';
import { ApiRequestError, createHttpClient } from './http-client';

describe('bounded messaging HTTP transport', () => {
  it('uses the verified bearer session and validates responses', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ value: 3 }) });
    const request = createHttpClient({
      apiBaseUrl: 'http://localhost:3000',
      getToken: () => Promise.resolve('session'),
      fetchImplementation: fetcher,
    });
    expect(await request('/test', z.object({ value: z.number() }))).toEqual({ value: 3 });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3000/test',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer session',
        },
      }),
    );
    fetcher.mockResolvedValue({ ok: true, json: () => Promise.resolve({ value: 'bad' }) });
    await expect(request('/test', z.object({ value: z.number() }))).rejects.toMatchObject({
      retryable: false,
    });
  });
  it('bounds even a hung token lookup and preserves retryable failure semantics', async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn();
    const request = createHttpClient({
      apiBaseUrl: 'http://localhost',
      getToken: () => new Promise(() => {}),
      fetchImplementation: fetcher,
      timeoutMs: 10,
    });
    const pending = request('/test', z.unknown());
    const assertion = expect(pending).rejects.toMatchObject({ retryable: true, code: 'TIMEOUT' });
    await jest.advanceTimersByTimeAsync(10);
    await assertion;
    expect(fetcher).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
  it('classifies authorization failures as terminal and never displays raw provider output', async () => {
    const request = createHttpClient({
      apiBaseUrl: 'http://localhost',
      getToken: () => Promise.resolve('session'),
      fetchImplementation: jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ private: 'raw database error' }),
      }),
    });
    await expect(request('/test', z.unknown())).rejects.toMatchObject({
      status: 404,
      retryable: false,
    });
    await expect(request('/test', z.unknown())).rejects.toBeInstanceOf(ApiRequestError);
  });
});
