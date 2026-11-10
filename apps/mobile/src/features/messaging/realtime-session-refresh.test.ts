import { RealtimeSessionRefresher, tokenExpiresAt } from './realtime-session-refresh';

function jwt(claims: Record<string, unknown>) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`;
}

describe('tokenExpiresAt', () => {
  it('reads the exp claim in milliseconds', () => {
    expect(tokenExpiresAt(jwt({ exp: 1_800_000_060, sub: 'user_1' }))).toBe(1_800_000_060_000);
  });

  it.each(['', 'not-a-jwt', 'a.%%%.c', jwt({ sub: 'no-exp' }), jwt({ exp: 'soon' })])(
    'returns null for %p',
    (token) => {
      expect(tokenExpiresAt(token)).toBeNull();
    },
  );
});

describe('RealtimeSessionRefresher', () => {
  let now = 0;
  beforeEach(() => {
    jest.useFakeTimers();
    now = 1_000_000;
  });
  afterEach(() => jest.useRealTimers());
  const advance = async (ms: number) => {
    now += ms;
    await jest.advanceTimersByTimeAsync(ms);
  };
  function refresher(send: jest.Mock, getFreshToken = jest.fn().mockResolvedValue('fresh')) {
    return {
      getFreshToken,
      instance: new RealtimeSessionRefresher({ getFreshToken, send, now: () => now }),
    };
  }

  it('refreshes 20 seconds before expiry and keeps following the new expiry', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, expiresAt: now + 120_000 })
      .mockResolvedValueOnce({ ok: true, expiresAt: now + 180_000 });
    const { instance } = refresher(send);
    instance.start(now + 60_000);

    await advance(39_999);
    expect(send).not.toHaveBeenCalled();
    await advance(1);
    expect(send).toHaveBeenCalledWith('fresh');

    await advance(59_999);
    expect(send).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(send).toHaveBeenCalledTimes(2);
    instance.stop();
  });

  it('uses a fallback delay when the expiry is unknown', async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, expiresAt: now + 600_000 });
    const { instance } = refresher(send);
    instance.start(null);

    await advance(30_000);
    expect(send).toHaveBeenCalledTimes(1);
    instance.stop();
  });

  it('retries a transient failure at a floor, but stops once the token runs out', async () => {
    const send = jest.fn().mockRejectedValue(new Error('ack timeout'));
    const { instance } = refresher(send);
    instance.start(now + 30_000);

    await advance(10_000);
    expect(send).toHaveBeenCalledTimes(1);
    await advance(5000);
    expect(send).toHaveBeenCalledTimes(2);
    await advance(5000);
    expect(send).toHaveBeenCalledTimes(3);
    // At 25 s only 5 s of the token remain: one last try, then the server closes the socket.
    await advance(5000);
    expect(send).toHaveBeenCalledTimes(4);
    await advance(60_000);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('leaves a rejected session to the reconnect path', async () => {
    const send = jest.fn().mockResolvedValue({ ok: false, code: 'AUTH_REQUIRED' });
    const { instance } = refresher(send);
    instance.start(now + 60_000);

    await advance(40_000);
    await advance(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does nothing after sign-out or after stop', async () => {
    const send = jest.fn();
    const signedOut = refresher(send, jest.fn().mockResolvedValue(null));
    signedOut.instance.start(now + 30_000);
    await advance(30_000);
    expect(send).not.toHaveBeenCalled();

    const stopped = refresher(send);
    stopped.instance.start(now + 30_000);
    stopped.instance.stop();
    await advance(60_000);
    expect(stopped.getFreshToken).not.toHaveBeenCalled();
  });
});
