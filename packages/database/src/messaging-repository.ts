import type { Message, MessageHistoryQuery, SendMessage } from '@pro-date/contracts';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import { DiscoveryError, type PagePosition } from './discovery-repository.js';
import { matches, messageOutbox, messages, users } from './schema.js';

type Transaction = Parameters<Parameters<ProDateDatabase['transaction']>[0]>[0];
type MatchRow = typeof matches.$inferSelect;
export interface ConversationRecord extends Record<string, unknown> {
  id: string;
  memberId: string;
  displayName: string;
  photoPublicId: string | null;
  photoVersion: number | null;
  createdAt: string;
  activityAt: string;
  lastMessage: Message | null;
}
const noBlocks = sql`not exists (select 1 from user_blocks b where
  (b.user_id = m.first_user_id and b.blocked_user_id = m.second_user_id) or
  (b.user_id = m.second_user_id and b.blocked_user_id = m.first_user_id))`;
export function buildConversationAccessQuery(viewerId: string, conversationId: string) {
  return sql`select m.* from matches m where m.id = ${conversationId}::uuid
    and (m.first_user_id = ${viewerId}::uuid or m.second_user_id = ${viewerId}::uuid)
    and m.unmatched_at is null and ${noBlocks}`;
}

const messageSelection = sql`id, conversation_id as "conversationId", sender_id as "senderId",
  client_id as "clientId", sequence, body,
  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt"`;
export function buildMessageHistoryQuery(
  conversationId: string,
  query: MessageHistoryQuery,
  beforeSequence?: number,
) {
  return sql`select ${messageSelection} from messages where conversation_id = ${conversationId}::uuid
    ${beforeSequence === undefined ? sql`` : sql`and sequence < ${beforeSequence}`}
    ${query.afterSequence === undefined ? sql`` : sql`and sequence > ${query.afterSequence}`}
    order by ${query.afterSequence === undefined ? sql`sequence desc` : sql`sequence asc`}
    limit ${query.limit + 1}`;
}

// Share/update locks use the same member ordering as block/report and match creation.
// Access is rechecked after acquiring locks, making a committed block authoritative.
export async function requireConversationAccess(
  tx: Transaction,
  viewerId: string,
  id: string,
  write: boolean,
): Promise<MatchRow> {
  const [candidate] = await tx
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.id, id),
        sql`(${matches.firstUserId} = ${viewerId}::uuid or ${matches.secondUserId} = ${viewerId}::uuid)`,
      ),
    )
    .limit(1);
  if (candidate === undefined) throw unavailable();
  await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, [candidate.firstUserId, candidate.secondUserId]))
    .orderBy(asc(users.id))
    .for(write ? 'update' : 'share');
  const result = await tx.execute(buildConversationAccessQuery(viewerId, id));
  if (result.rows.length === 0) throw unavailable();
  const [current] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .for(write ? 'update' : 'share');
  if (current === undefined || current.unmatchedAt !== null) throw unavailable();
  return current;
}
const unavailable = () =>
  new DiscoveryError('NOT_FOUND', 404, 'This conversation is no longer available.');
const toMessage = (row: typeof messages.$inferSelect): Message => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

function conversationQuery(viewerId: string, id?: string, position?: PagePosition, limit = 20) {
  // One lead photo and one latest message per row; no full profile/media payload.
  return sql`select m.id, p.user_id as "memberId", coalesce(p.display_name, 'Member') as "displayName",
    ph.provider_public_id as "photoPublicId", ph.provider_version::float8 as "photoVersion",
    to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",
    to_char(coalesce(last.created_at, m.created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "activityAt",
    last.id as "lastId", last.sender_id as "lastSenderId", last.client_id as "lastClientId",
    last.sequence as "lastSequence", last.body as "lastBody",
    to_char(last.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "lastCreatedAt"
    from matches m join profiles p on p.user_id = case when m.first_user_id = ${viewerId}::uuid then m.second_user_id else m.first_user_id end
    left join lateral (select provider_public_id, provider_version from profile_photos where user_id = p.user_id order by position limit 1) ph on true
    left join lateral (select * from messages where conversation_id = m.id order by sequence desc limit 1) last on true
    where (m.first_user_id = ${viewerId}::uuid or m.second_user_id = ${viewerId}::uuid)
    and m.unmatched_at is null and ${noBlocks}
    ${id === undefined ? sql`` : sql`and m.id = ${id}::uuid`}
    ${position?.at === undefined ? sql`` : sql`and (coalesce(last.created_at, m.created_at), m.id) < (${position.at}::timestamptz, ${position.id}::uuid)`}
    order by coalesce(last.created_at, m.created_at) desc, m.id desc limit ${limit + 1}`;
}
function assemble(row: Record<string, unknown>): ConversationRecord {
  return {
    id: row.id as string,
    memberId: row.memberId as string,
    displayName: row.displayName as string,
    photoPublicId: row.photoPublicId as string | null,
    photoVersion: row.photoVersion as number | null,
    createdAt: row.createdAt as string,
    activityAt: row.activityAt as string,
    lastMessage:
      row.lastId === null
        ? null
        : {
            id: row.lastId as string,
            conversationId: row.id as string,
            senderId: row.lastSenderId as string,
            clientId: row.lastClientId as string,
            sequence: row.lastSequence as number,
            body: row.lastBody as string,
            createdAt: row.lastCreatedAt as string,
          },
  };
}

export function createMessagingRepository(database: ProDateDatabase | Transaction) {
  return {
    async conversations(this: void, viewerId: string, limit: number, position?: PagePosition) {
      return (
        await database.execute(conversationQuery(viewerId, undefined, position, limit))
      ).rows.map(assemble);
    },
    async conversation(this: void, viewerId: string, id: string) {
      return database.transaction(async (tx) => {
        await requireConversationAccess(tx, viewerId, id, false);
        const [row] = (await tx.execute(conversationQuery(viewerId, id))).rows;
        if (row === undefined) throw unavailable();
        return assemble(row);
      });
    },
    async history(
      this: void,
      viewerId: string,
      id: string,
      query: MessageHistoryQuery,
      beforeSequence?: number,
    ) {
      return database.transaction(async (tx) => {
        const match = await requireConversationAccess(tx, viewerId, id, false);
        const rows = (
          await tx.execute<Message & Record<string, unknown>>(
            buildMessageHistoryQuery(id, query, beforeSequence),
          )
        ).rows;
        return { rows, latestSequence: match.lastMessageSequence };
      });
    },
    async send(this: void, viewerId: string, id: string, input: SendMessage): Promise<Message> {
      return database.transaction(async (tx) => {
        const match = await requireConversationAccess(tx, viewerId, id, true);
        const [existing] = await tx
          .select()
          .from(messages)
          .where(and(eq(messages.senderId, viewerId), eq(messages.clientId, input.clientId)))
          .limit(1);
        if (existing !== undefined) {
          if (existing.conversationId !== id || existing.body !== input.body)
            throw new DiscoveryError('CONFLICT', 409, 'That message identifier was already used.');
          return toMessage(existing);
        }
        const [{ count }] = (
          await tx.execute<{ count: number } & Record<string, unknown>>(sql`
          select count(*)::integer as count from messages where sender_id = ${viewerId}::uuid
          and created_at > clock_timestamp() - interval '1 minute'`)
        ).rows as [{ count: number }];
        if (count >= 60)
          throw new DiscoveryError(
            'RATE_LIMITED',
            429,
            'Take a moment before sending another message.',
          );
        const sequence = match.lastMessageSequence + 1;
        await tx.update(matches).set({ lastMessageSequence: sequence }).where(eq(matches.id, id));
        const [message] = await tx
          .insert(messages)
          .values({ conversationId: id, senderId: viewerId, ...input, sequence })
          .returning();
        if (message === undefined) throw new Error('Message persistence failed.');
        await tx.insert(messageOutbox).values({ messageId: message.id });
        return toMessage(message);
      });
    },
    async unmatch(this: void, viewerId: string, id: string) {
      await database.transaction(async (tx) => {
        await requireConversationAccess(tx, viewerId, id, true);
        await tx.update(matches).set({ unmatchedAt: new Date() }).where(eq(matches.id, id));
      });
    },
    async canAccess(this: void, viewerId: string, id: string) {
      return (await database.execute(buildConversationAccessQuery(viewerId, id))).rows.length > 0;
    },
    async claimEvents(this: void) {
      return (
        await database.execute<
          {
            messageId: string;
            conversationId: string;
            sequence: number;
            firstUserId: string;
            secondUserId: string;
          } & Record<string, unknown>
        >(sql`with pending as (
        select message_id from message_outbox where published_at is null
        and (leased_until is null or leased_until < clock_timestamp())
        order by created_at limit 50 for update skip locked
      ), claimed as (
        update message_outbox o set leased_until = clock_timestamp() + interval '30 seconds'
        from pending p where o.message_id = p.message_id returning o.message_id
      ) select msg.id as "messageId", msg.conversation_id as "conversationId", msg.sequence,
        m.first_user_id as "firstUserId", m.second_user_id as "secondUserId"
        from claimed c join messages msg on msg.id = c.message_id join matches m on m.id = msg.conversation_id`)
      ).rows;
    },
    async completeEvent(this: void, messageId: string) {
      await database
        .update(messageOutbox)
        .set({ publishedAt: new Date(), leasedUntil: null })
        .where(eq(messageOutbox.messageId, messageId));
    },
  };
}
export type MessagingRepository = ReturnType<typeof createMessagingRepository>;
