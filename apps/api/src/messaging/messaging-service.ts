import {
  conversationSchema,
  type Conversation,
  type InboxQuery,
  type MessageHistoryQuery,
  type SendMessage,
} from '@pro-date/contracts';
import {
  DiscoveryError,
  type ConversationRecord,
  type MessagingRepository,
} from '@pro-date/database';
import { z } from 'zod';

import { decodeDiscoveryCursor, encodeDiscoveryCursor } from '../discovery/cursor.js';

const historyCursorSchema = z.strictObject({
  viewerId: z.uuid(),
  conversationId: z.uuid(),
  beforeSequence: z.number().int().positive(),
});
export function createMessagingService(
  repository: MessagingRepository,
  getPhotoUrl: (id: string, version: number) => string,
  onCommitted: () => void = () => {},
) {
  const present = (row: ConversationRecord): Conversation =>
    conversationSchema.parse({
      id: row.id,
      createdAt: row.createdAt,
      activityAt: row.activityAt,
      lastMessage: row.lastMessage,
      member: {
        userId: row.memberId,
        displayName: row.displayName,
        photoUrl:
          row.photoPublicId === null || row.photoVersion === null
            ? null
            : getPhotoUrl(row.photoPublicId, row.photoVersion),
      },
    });
  return {
    async conversations(this: void, viewerId: string, query: InboxQuery) {
      const scope = `conversations:${viewerId}`;
      const position =
        query.cursor === undefined ? undefined : decodeDiscoveryCursor(query.cursor, scope);
      const rows = await repository.conversations(viewerId, query.limit, position);
      const last = rows[query.limit - 1];
      return {
        data: rows.slice(0, query.limit).map(present),
        nextCursor:
          rows.length > query.limit && last !== undefined
            ? encodeDiscoveryCursor(scope, {
                ceiling: new Date().toISOString(),
                at: last.activityAt,
                id: last.id,
              })
            : null,
      };
    },
    async conversation(this: void, viewerId: string, id: string) {
      return present(await repository.conversation(viewerId, id));
    },
    async history(this: void, viewerId: string, id: string, query: MessageHistoryQuery) {
      let beforeSequence: number | undefined;
      if (query.cursor !== undefined) {
        try {
          const cursor = historyCursorSchema.parse(
            JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')),
          );
          if (cursor.viewerId !== viewerId || cursor.conversationId !== id)
            throw new Error('Wrong cursor scope.');
          beforeSequence = cursor.beforeSequence;
        } catch {
          throw new DiscoveryError(
            'INVALID_CURSOR',
            422,
            'Refresh this conversation and try again.',
          );
        }
      }
      const { rows, latestSequence } = await repository.history(
        viewerId,
        id,
        query,
        beforeSequence,
      );
      const selected = rows.slice(0, query.limit);
      const forward = query.afterSequence !== undefined;
      const data = forward ? selected : selected.reverse();
      return {
        data,
        latestSequence,
        olderCursor:
          !forward && rows.length > query.limit && data[0] !== undefined
            ? Buffer.from(
                JSON.stringify({ viewerId, conversationId: id, beforeSequence: data[0].sequence }),
              ).toString('base64url')
            : null,
        nextAfterSequence: forward && rows.length > query.limit ? data.at(-1)!.sequence : null,
      };
    },
    async send(this: void, viewerId: string, id: string, input: SendMessage) {
      const message = await repository.send(viewerId, id, input);
      onCommitted();
      return message;
    },
    unmatch: (viewerId: string, id: string) => repository.unmatch(viewerId, id),
  };
}
export type MessagingService = ReturnType<typeof createMessagingService>;
