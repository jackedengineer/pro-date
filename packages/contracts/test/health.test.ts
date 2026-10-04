import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from '../src/health.js';

describe('healthResponseSchema', () => {
  it('accepts a healthy liveness response', () => {
    const response = {
      requestId: '4b4573b7-3087-49f3-a22b-c1d453cfe957',
      service: 'api',
      status: 'ok',
      timestamp: '2026-10-04T10:30:00.000Z',
    };

    expect(healthResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts an unavailable readiness response with named checks', () => {
    const response = {
      checks: {
        database: 'down',
      },
      requestId: 'c866798e-3114-434c-90b7-65c83b93b469',
      service: 'api',
      status: 'unavailable',
      timestamp: '2026-10-04T10:30:00.000Z',
    };

    expect(healthResponseSchema.parse(response)).toEqual(response);
  });

  it.each([
    { field: 'status', value: 'unknown' },
    { field: 'requestId', value: 'not-a-uuid' },
    { field: 'timestamp', value: '04/10/2026' },
  ])('rejects an invalid $field', ({ field, value }) => {
    const response = {
      requestId: '4b4573b7-3087-49f3-a22b-c1d453cfe957',
      service: 'api',
      status: 'ok',
      timestamp: '2026-10-04T10:30:00.000Z',
      [field]: value,
    };

    expect(healthResponseSchema.safeParse(response).success).toBe(false);
  });

  it('rejects fields outside the public contract', () => {
    const response = {
      internalError: 'database password rejected',
      requestId: '4b4573b7-3087-49f3-a22b-c1d453cfe957',
      service: 'api',
      status: 'unavailable',
      timestamp: '2026-10-04T10:30:00.000Z',
    };

    expect(healthResponseSchema.safeParse(response).success).toBe(false);
  });
});
