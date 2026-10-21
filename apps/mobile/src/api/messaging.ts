import {
  conversationResponseSchema,
  chatCapabilitiesResponseSchema,
  messageContextResponseSchema,
  messageContextQuerySchema,
  interactionChangesResponseSchema,
  messageReactionResponseSchema,
  setMessageReactionSchema,
  type SetMessageReaction,
  type MessageContexts,
  type InteractionChanges,
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
import { ApiRequestError, createHttpClient } from './http-client';

export function createMessagingApi(options: Parameters<typeof createHttpClient>[0]) {
  const request = createHttpClient(options);
  const path = (id: string) => `/v1/conversations/${encodeURIComponent(id)}`;
  return {
    async interactionChanges(
      this: void,
      id: string,
      afterRevision: number,
      signal?: AbortSignal,
    ): Promise<InteractionChanges> {
      return request(
        `${path(id)}/interaction-changes?afterRevision=${afterRevision}&limit=50`,
        interactionChangesResponseSchema,
        { signal: signal ?? null },
      );
    },
    async setReaction(
      this: void,
      id: string,
      messageId: string,
      input: SetMessageReaction,
      signal?: AbortSignal,
    ) {
      const result = (
        await request(
          `${path(id)}/messages/${encodeURIComponent(messageId)}/reaction`,
          messageReactionResponseSchema,
          {
            method: 'PUT',
            body: JSON.stringify(setMessageReactionSchema.parse(input)),
            signal: signal ?? null,
          },
        )
      ).data;
      if (result.messageId !== messageId)
        throw new ApiRequestError(
          'The server sent an unexpected response. Refresh before trying again.',
          502,
          'INVALID_RESPONSE',
          false,
        );
      return result;
    },
    async capabilities(this: void, id: string, signal?: AbortSignal) {
      return (
        await request(`${path(id)}/capabilities`, chatCapabilitiesResponseSchema, {
          signal: signal ?? null,
        })
      ).data;
    },
    async contexts(
      this: void,
      id: string,
      ids: string[],
      signal?: AbortSignal,
    ): Promise<MessageContexts> {
      messageContextQuerySchema.parse({ ids: ids.join(',') });
      const page = await request(
        `${path(id)}/message-context?ids=${encodeURIComponent(ids.join(','))}`,
        messageContextResponseSchema,
        { signal: signal ?? null },
      );
      if (page.data.some((context) => !ids.includes(context.messageId)))
        throw new ApiRequestError(
          'The server sent an unexpected response. Refresh before trying again.',
          502,
          'INVALID_RESPONSE',
          false,
        );
      return page;
    },
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
