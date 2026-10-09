import { chatNotificationPayloadSchema, type ChatNotificationPayload } from '@pro-date/contracts';
import { z } from 'zod';

export type PushErrorCode =
  | 'INVALID_DEVICE'
  | 'PAYLOAD'
  | 'CONFIGURATION'
  | 'THROTTLED'
  | 'PROVIDER'
  | 'INVALID_RESPONSE'
  | 'NETWORK';
export type PushResult =
  | { kind: 'ACCEPTED'; ticketId: string }
  | { kind: 'RETRYABLE' | 'UNKNOWN' | 'FAILED'; code: PushErrorCode; retryAfterMs?: number };
export type ReceiptResult =
  { kind: 'OK' | 'PENDING' } | { kind: 'ERROR' | 'RETRYABLE'; code: PushErrorCode };
export interface PushDelivery {
  token: string;
  payload: ChatNotificationPayload;
  ttl: number;
}
const itemSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), id: z.string().min(1).max(128).optional() }),
  z.object({ status: z.literal('error'), details: z.object({ error: z.string() }).optional() }),
]);
const errorCode = (error: string | undefined): PushErrorCode => {
  switch (error) {
    case 'DeviceNotRegistered':
      return 'INVALID_DEVICE';
    case 'MessageTooBig':
      return 'PAYLOAD';
    case 'InvalidCredentials':
    case 'MismatchSenderId':
    case 'UNAUTHORIZED':
      return 'CONFIGURATION';
    case 'MessageRateExceeded':
    case 'TOO_MANY_REQUESTS':
      return 'THROTTLED';
    default:
      return 'PROVIDER';
  }
};
const failure = (code: PushErrorCode): PushResult => ({
  kind: code === 'PROVIDER' || code === 'THROTTLED' ? 'RETRYABLE' : 'FAILED',
  code,
});

/** One HTTP request per application attempt. Responses and provider text are untrusted.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
export function createExpoPushProvider(
  accessToken: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 10_000,
) {
  if (!accessToken.trim() || /[\r\n]/.test(accessToken))
    throw new Error('Enhanced Expo push authentication is required.');
  async function request(endpoint: 'send' | 'getReceipts', body: unknown) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Provider deadline'));
      }, timeoutMs);
    });
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const work = async () => {
      const response = await fetcher(`https://exp.host/--/api/v2/push/${endpoint}`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (controller.signal.aborted) {
        void response.body?.cancel().catch(() => {});
        throw new Error('Provider deadline');
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        const retry = Number(response.headers.get('retry-after'));
        const retryAfterMs =
          Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 900_000) : 0;
        return { status: response.status, body: null, retryAfterMs };
      }
      reader = response.body?.getReader();
      if (reader === undefined) throw new SyntaxError('Missing provider body');
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 65_536) throw new SyntaxError('Oversized provider body');
        chunks.push(value);
      }
      return {
        status: response.status,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
        retryAfterMs: 0,
      };
    };
    try {
      return await Promise.race([work(), deadline]);
    } finally {
      clearTimeout(timer);
      controller.abort();
      void reader?.cancel().catch(() => {});
    }
  }
  function httpFailure(status: number, retryAfterMs: number): PushResult | null {
    if (status === 200) return null;
    if (status === 401 || status === 403) return failure('CONFIGURATION');
    if (status === 429) return { kind: 'RETRYABLE', code: 'THROTTLED', retryAfterMs };
    if (status >= 500 || status === 408) return { kind: 'UNKNOWN', code: 'PROVIDER' };
    return failure('PAYLOAD');
  }
  return {
    async send(delivery: PushDelivery): Promise<PushResult> {
      const payload = chatNotificationPayloadSchema.parse(delivery.payload);
      try {
        const result = await request('send', [
          {
            to: delivery.token,
            title: 'ProDate',
            body: 'New message on ProDate.',
            data: payload,
            channelId: 'messages',
            sound: 'default',
            priority: 'high',
            ttl: delivery.ttl,
          },
        ]);
        const failed = httpFailure(result.status, result.retryAfterMs);
        if (failed !== null) return failed;
        const { data } = z.object({ data: z.array(itemSchema).length(1) }).parse(result.body);
        const item = data[0]!;
        if (item.status === 'error') return failure(errorCode(item.details?.error));
        if (item.id === undefined) throw new SyntaxError('Missing ticket');
        return { kind: 'ACCEPTED', ticketId: item.id };
      } catch (error) {
        return {
          kind: 'UNKNOWN',
          code:
            error instanceof SyntaxError || error instanceof z.ZodError
              ? 'INVALID_RESPONSE'
              : 'NETWORK',
        };
      }
    },
    async receipt(ticketId: string): Promise<ReceiptResult> {
      try {
        const result = await request('getReceipts', { ids: [ticketId] });
        const failed = httpFailure(result.status, result.retryAfterMs);
        if (failed !== null && failed.kind !== 'ACCEPTED')
          return {
            kind: failed.code === 'CONFIGURATION' ? 'ERROR' : 'RETRYABLE',
            code: failed.code,
          };
        const { data } = z.object({ data: z.record(z.string(), itemSchema) }).parse(result.body);
        const item = data[ticketId];
        return item === undefined
          ? { kind: 'PENDING' }
          : item.status === 'ok'
            ? { kind: 'OK' }
            : { kind: 'ERROR', code: errorCode(item.details?.error) };
      } catch {
        return { kind: 'RETRYABLE', code: 'NETWORK' };
      }
    },
  };
}
export type ExpoPushProvider = ReturnType<typeof createExpoPushProvider>;
