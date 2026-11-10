import { apiErrorResponseSchema } from '@pro-date/contracts';
import { describe, expect, it } from 'vitest';

import {
  CLIENT_IP_HEADER,
  configFingerprint,
  containerEnvironment,
  readContainerSettings,
  toContainerRequest,
  unavailableResponse,
  withClientAddress,
  type GatewayEnv,
} from '../src/gateway';

const env: GatewayEnv = {
  CONTAINER_MODE: 'on-demand',
  CONTAINER_INSTANCE: 'standard-1',
  CONTAINER_IDLE_MINUTES: '15',
  API_LOG_LEVEL: 'info',
  CHAT_REPLIES_ENABLED: 'true',
  CHAT_REACTIONS_ENABLED: 'true',
  MEDIA_RECONCILE_ENABLED: 'false',
  NOTIFICATIONS_ENABLED: 'false',
  PUSH_ENABLED: 'false',
  CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  CLERK_SECRET_KEY: 'sk_test_super_secret',
  DATABASE_URL: 'postgresql://user:password@example.test/db?sslmode=verify-full',
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'cloudinary_secret',
};

describe('client address forwarding', () => {
  it('replaces a spoofed client address with the one Cloudflare observed', () => {
    const forwarded = withClientAddress(
      new Request('https://merge-api.jacked.dev/v1/discovery', {
        headers: {
          [CLIENT_IP_HEADER]: '1.1.1.1',
          'cf-connecting-ip': '203.0.113.9',
          authorization: 'Bearer t',
        },
      }),
    );
    expect(forwarded.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.9');
    expect(forwarded.headers.get('authorization')).toBe('Bearer t');
  });

  it('never forwards a client-supplied address when Cloudflare provided none', () => {
    const forwarded = withClientAddress(
      new Request('https://merge-api.jacked.dev/', { headers: { [CLIENT_IP_HEADER]: '1.1.1.1' } }),
    );
    expect(forwarded.headers.has(CLIENT_IP_HEADER)).toBe(false);
  });
});

describe('container request rewriting', () => {
  it('targets the container while keeping path, query, method, body and upgrade headers', async () => {
    const original = new Request(
      'https://merge-api.jacked.dev/v1/conversations/abc/messages?limit=5',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
        body: JSON.stringify({ body: 'hi' }),
      },
    );
    const forwarded = toContainerRequest(original);
    expect(forwarded.url).toBe('http://container/v1/conversations/abc/messages?limit=5');
    expect(forwarded.method).toBe('POST');
    expect(forwarded.headers.get('authorization')).toBe('Bearer t');
    expect(forwarded.headers.has('host')).toBe(false);
    expect(await forwarded.text()).toBe('{"body":"hi"}');

    const socket = toContainerRequest(
      new Request('https://merge-api.jacked.dev/socket.io/?EIO=4&transport=websocket', {
        headers: { upgrade: 'websocket', 'sec-websocket-key': 'abc==' },
      }),
    );
    expect(socket.url).toBe('http://container/socket.io/?EIO=4&transport=websocket');
    expect(socket.headers.get('upgrade')).toBe('websocket');
  });
});

describe('container settings', () => {
  it('reads the deployed mode, size and idle timeout', () => {
    expect(readContainerSettings(env)).toEqual({
      mode: 'on-demand',
      instance: 'standard-1',
      idleMs: 15 * 60_000,
    });
  });

  it('fails closed on values that would start an unintended container', () => {
    for (const override of [
      { CONTAINER_MODE: 'sometimes' },
      { CONTAINER_INSTANCE: 'basic' },
      { CONTAINER_IDLE_MINUTES: '0' },
      { CONTAINER_IDLE_MINUTES: '361' },
      { CONTAINER_IDLE_MINUTES: '1.5' },
    ])
      expect(() => readContainerSettings({ ...env, ...override })).toThrow();
  });

  it('starts the API in production mode behind the trusted client-address header', () => {
    expect(containerEnvironment(env)).toMatchObject({
      NODE_ENV: 'production',
      PORT: '8080',
      HOST: '0.0.0.0',
      TRUSTED_CLIENT_IP_HEADER: CLIENT_IP_HEADER,
      CLERK_TELEMETRY_DISABLED: '1',
      CHAT_REPLIES_ENABLED: 'true',
      PUSH_ENABLED: 'false',
      MEDIA_RECONCILE_ENABLED: 'false',
    });
  });
});

describe('container configuration fingerprint', () => {
  it('is stable, order-independent and never contains secret values', async () => {
    const environment = containerEnvironment(env);
    const reversed = Object.fromEntries(Object.entries(environment).reverse());
    const first = await configFingerprint('registry/api@sha256:1', 'standard-1', environment);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(await configFingerprint('registry/api@sha256:1', 'standard-1', reversed)).toBe(first);
    expect(first).not.toContain('secret');
  });

  it('changes when the image, size or a rotated secret changes, forcing a rollout', async () => {
    const environment = containerEnvironment(env);
    const base = await configFingerprint('registry/api@sha256:1', 'standard-1', environment);
    expect(await configFingerprint('registry/api@sha256:2', 'standard-1', environment)).not.toBe(
      base,
    );
    expect(await configFingerprint('registry/api@sha256:1', 'lite', environment)).not.toBe(base);
    expect(
      await configFingerprint(
        'registry/api@sha256:1',
        'standard-1',
        containerEnvironment({ ...env, CLERK_SECRET_KEY: 'sk_test_rotated' }),
      ),
    ).not.toBe(base);
  });
});

describe('unavailable response', () => {
  it('matches the API error contract so the app retries it as a transient failure', async () => {
    const response = unavailableResponse();
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(apiErrorResponseSchema.safeParse(await response.json()).success).toBe(true);
  });
});
