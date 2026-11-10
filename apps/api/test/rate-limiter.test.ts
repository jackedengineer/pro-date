import { describe, expect, it } from 'vitest';

import { createRateLimiter } from '../src/rate-limiter.js';

describe('rate limiter', () => {
  it('allows a burst, then refills at the configured rate', () => {
    let now = 0;
    const limiter = createRateLimiter({ burst: 3, refillPerMinute: 6 }, () => now);

    expect([1, 2, 3].map(() => limiter.take('a').allowed)).toEqual([true, true, true]);
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterMs: 10_000 });

    now = 10_000;
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });

  it('keeps separate budgets per key', () => {
    const limiter = createRateLimiter({ burst: 1, refillPerMinute: 1 }, () => 0);

    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    expect(limiter.take('b').allowed).toBe(true);
  });

  it('drops refilled keys before refusing new ones at capacity', () => {
    let now = 0;
    const limiter = createRateLimiter({ burst: 1, refillPerMinute: 1, maxKeys: 2 }, () => now);

    limiter.take('a');
    limiter.take('b');
    expect(limiter.take('c').allowed).toBe(false);

    now = 60_000;
    expect(limiter.take('c').allowed).toBe(true);
    expect(limiter.size()).toBe(1);
  });
});
