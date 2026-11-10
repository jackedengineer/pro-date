export interface RateLimit {
  /** Requests a key may make back to back. */
  burst: number;
  /** Requests regained per minute after the burst is spent. */
  refillPerMinute: number;
  /** Most keys tracked at once; idle, refilled keys are dropped first. */
  maxKeys?: number;
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * A process-local token bucket per key (for example an internal user id).
 * The API runs as one container, so this bounds abuse without shared storage;
 * a multi-instance deployment would need a shared counter instead.
 */
export function createRateLimiter(limit: RateLimit, now: () => number = Date.now) {
  const maxKeys = limit.maxKeys ?? 10_000;
  const perMs = limit.refillPerMinute / 60_000;
  const buckets = new Map<string, { tokens: number; updatedAt: number }>();
  const refill = (bucket: { tokens: number; updatedAt: number }, at: number) => {
    bucket.tokens = Math.min(
      limit.burst,
      bucket.tokens + Math.max(0, at - bucket.updatedAt) * perMs,
    );
    bucket.updatedAt = at;
  };
  return {
    take(key: string): RateLimitDecision {
      const at = now();
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        if (buckets.size >= maxKeys) {
          for (const [other, entry] of buckets) {
            refill(entry, at);
            if (entry.tokens >= limit.burst) buckets.delete(other);
          }
          // Every tracked key is mid-burst; refuse rather than grow without bound.
          if (buckets.size >= maxKeys) return { allowed: false, retryAfterMs: 60_000 };
        }
        bucket = { tokens: limit.burst, updatedAt: at };
        buckets.set(key, bucket);
      }
      refill(bucket, at);
      if (bucket.tokens < 1) {
        return { allowed: false, retryAfterMs: Math.ceil((1 - bucket.tokens) / perMs) };
      }
      bucket.tokens -= 1;
      return { allowed: true };
    },
    size: () => buckets.size,
  };
}
