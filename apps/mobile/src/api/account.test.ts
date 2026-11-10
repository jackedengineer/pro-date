import { ACCOUNT_DELETION_TIMEOUT_MS, deleteAccount } from './account';

const apiBaseUrl = 'https://api.merge.example';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const getToken = () => Promise.resolve('session-token');
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status });

describe('deleteAccount', () => {
  it("asks the server to delete the signed-in member's account", async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(json({ data: { deleted: true, signInRemoved: false }, requestId }));

    await expect(deleteAccount({ apiBaseUrl, fetchImplementation, getToken })).resolves.toEqual({
      signInRemoved: false,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me`, {
      headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
      method: 'DELETE',
      signal: expect.any(AbortSignal) as unknown,
    });
  });

  it('never calls the server without a session', async () => {
    const fetchImplementation = jest.fn();

    await expect(
      deleteAccount({ apiBaseUrl, fetchImplementation, getToken: () => Promise.resolve(null) }),
    ).rejects.toThrow('Your session expired.');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('passes on the server’s reason, and rejects a reply it cannot read as success', async () => {
    await expect(
      deleteAccount({
        apiBaseUrl,
        getToken,
        fetchImplementation: jest.fn().mockResolvedValue(
          json(
            {
              error: { code: 'ACCOUNT_DELETION_UNAVAILABLE', message: 'Try again shortly.' },
              requestId,
            },
            503,
          ),
        ),
      }),
    ).rejects.toThrow('Try again shortly.');
    await expect(
      deleteAccount({
        apiBaseUrl,
        getToken,
        fetchImplementation: jest.fn().mockResolvedValue(json({ ok: true })),
      }),
    ).rejects.toThrow('unexpected response');
  });

  it('gives up on a stalled request instead of leaving the button spinning', async () => {
    jest.useFakeTimers();
    try {
      const fetchImplementation: typeof fetch = (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      const outcome = expect(
        deleteAccount({ apiBaseUrl, fetchImplementation, getToken }),
      ).rejects.toThrow('That took too long');
      await jest.advanceTimersByTimeAsync(ACCOUNT_DELETION_TIMEOUT_MS);
      await outcome;
    } finally {
      jest.useRealTimers();
    }
  });
});
