import { describe, expect, it, vi } from 'vitest';
import { createExpoPushProvider } from '../src/notifications/expo-push-provider.js';

const payload = {
  version: 1 as const,
  type: 'CHAT_MESSAGE' as const,
  conversationId: '10000000-0000-4000-8000-000000000001',
  messageId: '10000000-0000-4000-8000-000000000002',
  recipientId: '10000000-0000-4000-8000-000000000003',
};
const delivery = { token: 'ExpoPushToken[test]', payload, ttl: 300 };
function setup(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));
  return { fetcher, provider: createExpoPushProvider('private-test-access', fetcher) };
}
describe('Expo provider boundary (fake transport; no remote push)', () => {
  it('requires enhanced authentication and sends only fixed generic text and validated routing data', async () => {
    expect(() => createExpoPushProvider('')).toThrow();
    const { provider, fetcher } = setup({ data: [{ status: 'ok', id: 'ticket-1' }] });
    await expect(provider.send(delivery)).resolves.toEqual({
      kind: 'ACCEPTED',
      ticketId: 'ticket-1',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(init).toMatchObject({
      redirect: 'error',
      headers: { Authorization: 'Bearer private-test-access' },
    });
    expect(JSON.parse(init!.body as string)).toEqual([
      {
        to: delivery.token,
        title: 'ProDate',
        body: 'New message on ProDate.',
        data: payload,
        channelId: 'messages',
        sound: 'default',
        priority: 'high',
        ttl: 300,
      },
    ]);
  });
  it.each([
    ['DeviceNotRegistered', 'INVALID_DEVICE'],
    ['MessageTooBig', 'PAYLOAD'],
    ['InvalidCredentials', 'CONFIGURATION'],
    ['MismatchSenderId', 'CONFIGURATION'],
    ['MessageRateExceeded', 'THROTTLED'],
    ['unknown-private-provider-text', 'PROVIDER'],
  ])('maps %s to a bounded code without forwarding provider text', async (error, code) => {
    const { provider } = setup({
      data: [{ status: 'error', message: 'private token content', details: { error } }],
    });
    expect(await provider.send(delivery)).toMatchObject({ code });
  });
  it('owns no automatic retries and bounds Retry-After', async () => {
    const { provider, fetcher } = setup({}, 429, { 'Retry-After': '999999' });
    expect(await provider.send(delivery)).toEqual({
      kind: 'RETRYABLE',
      code: 'THROTTLED',
      retryAfterMs: 900_000,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403])('opens a configuration circuit for HTTP %s', async (status) => {
    expect(await setup({}, status).provider.send(delivery)).toMatchObject({
      kind: 'FAILED',
      code: 'CONFIGURATION',
    });
  });
  it.each([
    { data: [] },
    { data: [{ status: 'ok' }] },
    {
      data: [
        { status: 'ok', id: 'x' },
        { status: 'ok', id: 'y' },
      ],
    },
  ])('treats malformed/mismatched acknowledgements as unknown, not success', async (body) => {
    expect(await setup(body).provider.send(delivery)).toEqual({
      kind: 'UNKNOWN',
      code: 'INVALID_RESPONSE',
    });
  });
  it('bounds response bytes and body-read duration, not just response headers', async () => {
    const large = setup({ data: 'x'.repeat(70_000) });
    expect(await large.provider.send(delivery)).toEqual({
      kind: 'UNKNOWN',
      code: 'INVALID_RESPONSE',
    });
    const stream = new ReadableStream<Uint8Array>({ start() {} });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream));
    const provider = createExpoPushProvider('private-test-access', fetcher, 10);
    expect(await provider.send(delivery)).toEqual({ kind: 'UNKNOWN', code: 'NETWORK' });
  });
  it('never pretends a rejected transport proves that handoff did not happen', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret provider response'));
    expect(await createExpoPushProvider('private-test-access', fetcher).send(delivery)).toEqual({
      kind: 'UNKNOWN',
      code: 'NETWORK',
    });
  });
  it('fetches receipts separately; an absent receipt is pending, not a reason to resend', async () => {
    const { provider, fetcher } = setup({ data: { 'ticket-1': { status: 'ok' } } });
    expect(await provider.receipt('ticket-1')).toEqual({ kind: 'OK' });
    expect(fetcher.mock.calls[0]![0]).toBe('https://exp.host/--/api/v2/push/getReceipts');
    expect(await setup({ data: {} }).provider.receipt('ticket-1')).toEqual({ kind: 'PENDING' });
    expect(
      await setup({
        data: { 'ticket-1': { status: 'error', details: { error: 'DeviceNotRegistered' } } },
      }).provider.receipt('ticket-1'),
    ).toEqual({ kind: 'ERROR', code: 'INVALID_DEVICE' });
  });
});
