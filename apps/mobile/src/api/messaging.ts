import {
  conversationResponseSchema,
  conversationsResponseSchema,
  messageHistoryResponseSchema,
  messageResponseSchema,
  actionResponseSchema,
  sendMessageSchema,
  type MessageHistory,
  type MessageHistoryQuery,
  type SendMessage,
  currentUserResponseSchema,
} from '@pro-date/contracts';
import { createHttpClient } from './http-client';

export function createMessagingApi(options: Parameters<typeof createHttpClient>[0]) {
  const request = createHttpClient(options);
  const path = (id: string) => `/v1/conversations/${encodeURIComponent(id)}`;
  return {
    async conversations(cursor?: string, signal?: AbortSignal) {
      const page = await request(
        `/v1/conversations?limit=20${cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`}`,
        conversationsResponseSchema,
        { signal: signal ?? null },
      );
      return { data: page.data, nextCursor: page.nextCursor };
    },
    async conversation(this: void, id: string, signal?: AbortSignal) {
      return (await request(path(id), conversationResponseSchema, { signal: signal ?? null })).data;
    },
    async history(
      this: void,
      id: string,
      query: Partial<MessageHistoryQuery> = {},
      signal?: AbortSignal,
    ): Promise<MessageHistory> {
      const params = new URLSearchParams({ limit: '50' });
      if (query.cursor !== undefined) params.set('cursor', query.cursor);
      if (query.afterSequence !== undefined)
        params.set('afterSequence', String(query.afterSequence));
      return request(`${path(id)}/messages?${params}`, messageHistoryResponseSchema, {
        signal: signal ?? null,
      });
    },
    async send(this: void, id: string, input: SendMessage, signal?: AbortSignal) {
      return (
        await request(`${path(id)}/messages`, messageResponseSchema, {
          method: 'POST',
          body: JSON.stringify(sendMessageSchema.parse(input)),
          signal: signal ?? null,
        })
      ).data;
    },
    async unmatch(id: string) {
      await request(path(id), actionResponseSchema, { method: 'DELETE' });
    },
  };
}
export type MessagingApi = ReturnType<typeof createMessagingApi>;
export async function bootstrapChatUser(options: Parameters<typeof createHttpClient>[0]) {
  return (
    await createHttpClient(options)('/v1/users/me', currentUserResponseSchema, { method: 'PUT' })
  ).data;
}
