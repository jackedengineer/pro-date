import { describe, expect, it } from 'vitest';

import { discoveryQuerySchema, sendPullRequestSchema } from '../src/discovery';

describe('discovery contracts', () => {
  it('provides bounded defaults and rejects invalid age ranges', () => {
    expect(discoveryQuerySchema.parse({})).toEqual({
      limit: 10,
      radiusKm: 50,
      minAge: 18,
      maxAge: 99,
    });
    expect(discoveryQuerySchema.safeParse({ minAge: 30, maxAge: 20 }).success).toBe(false);
    expect(discoveryQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
    expect(discoveryQuerySchema.safeParse({ minAge: 17 }).success).toBe(false);
  });

  it('requires a specific photo or prompt and normalizes an optional opening comment', () => {
    const input = {
      recipientUserId: '729438da-99b3-4d3d-b566-bfe94401829b',
      targetType: 'PHOTO',
      targetId: '10000000-0000-4000-8000-000000000001',
      comment: '   Hey, love this photo!   ',
    };
    expect(sendPullRequestSchema.parse(input).comment).toBe('Hey, love this photo!');
    expect(sendPullRequestSchema.safeParse({ ...input, targetType: 'PROFILE' }).success).toBe(
      false,
    );
    expect(sendPullRequestSchema.safeParse({ ...input, comment: 'x'.repeat(281) }).success).toBe(
      false,
    );
  });
});
