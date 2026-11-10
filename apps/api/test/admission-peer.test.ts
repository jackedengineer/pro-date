import { describe, expect, it } from 'vitest';

import { readApiServiceEnvironment } from '../src/env.js';
import { admissionPeer } from '../src/messaging/messaging-realtime.js';

const baseEnvironment = {
  CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  CLERK_SECRET_KEY: 'sk_test_example',
  DATABASE_URL: 'postgresql://user:password@example.test/db',
};

describe('realtime admission peer behind a gateway', () => {
  it('uses the TCP peer unless a trusted gateway header is configured', () => {
    const headers = { 'x-merge-client-ip': '203.0.113.7' };
    expect(admissionPeer('10.0.0.1', headers, null)).toBe('10.0.0.1');
    expect(admissionPeer('10.0.0.1', headers, 'x-merge-client-ip')).toBe('203.0.113.7');
    expect(
      admissionPeer('10.0.0.1', { 'x-merge-client-ip': '2001:db8::1' }, 'x-merge-client-ip'),
    ).toBe('2001:db8::1');
  });

  it('falls back to the TCP peer when the trusted header is missing or not IP-shaped', () => {
    for (const value of [undefined, '', 'evil value', 'a'.repeat(46), ['203.0.113.7']])
      expect(admissionPeer('10.0.0.1', { 'x-merge-client-ip': value }, 'x-merge-client-ip')).toBe(
        '10.0.0.1',
      );
    expect(admissionPeer(undefined, {}, 'x-merge-client-ip')).toBe('unknown');
  });

  it('reads an optional, header-shaped gateway setting from the environment', () => {
    expect(readApiServiceEnvironment(baseEnvironment).trustedClientIpHeader).toBeNull();
    expect(
      readApiServiceEnvironment({
        ...baseEnvironment,
        TRUSTED_CLIENT_IP_HEADER: 'x-merge-client-ip',
      }).trustedClientIpHeader,
    ).toBe('x-merge-client-ip');
    expect(() =>
      readApiServiceEnvironment({
        ...baseEnvironment,
        TRUSTED_CLIENT_IP_HEADER: 'X Forwarded: For',
      }),
    ).toThrow();
  });
});
