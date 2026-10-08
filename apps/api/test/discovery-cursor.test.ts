import { describe, expect, it } from 'vitest';
import { decodeDiscoveryCursor, encodeDiscoveryCursor } from '../src/discovery/cursor.js';

const scope = 'discovery:user-one:50:18:99';
const position = {
  id: '10000000-0000-4000-8000-000000000001',
  at: '2026-10-08T12:30:00.123456Z',
  ceiling: '2026-10-08T13:00:00.000Z',
};

describe('discovery cursor', () => {
  it('round trips microsecond ordering and binds the cursor to its viewer and filters', () => {
    const cursor = encodeDiscoveryCursor(scope, position);
    expect(decodeDiscoveryCursor(cursor, scope)).toEqual(position);
    expect(() => decodeDiscoveryCursor(cursor, 'discovery:user-two:50:18:99')).toThrow();
    expect(() => decodeDiscoveryCursor(cursor, 'discovery:user-one:200:18:99')).toThrow();
  });
  it('rejects malformed cursors before database access', () => {
    for (const value of ['!', 'e30', 'x'.repeat(1700)])
      expect(() => decodeDiscoveryCursor(value, scope)).toThrow();
  });
});
