import type {
  InteractionChangesQuery,
  MessageContext,
  ReactionKind,
  SetMessageReaction,
} from '@pro-date/contracts';
import { sql } from 'drizzle-orm';
import type { ProDateDatabase } from './client.js';
import { DiscoveryError } from './discovery-repository.js';

export type ChatTransaction = Parameters<Parameters<ProDateDatabase['transaction']>[0]>[0];
export interface InteractionFeatures {
  repliesEnabled?: boolean;
  reactionsEnabled?: boolean;
}
export function reactionNeedsWrite(
  current: { reaction: ReactionKind | null; revision: number } | null,
  input: SetMessageReaction,
): boolean {
  const revision = current?.revision ?? 0;
  const same = (current?.reaction ?? null) === input.reaction;
  if (revision === input.expectedRevision) return !same;
  if (revision === input.expectedRevision + 1 && same) return false;
  throw new DiscoveryError('CONFLICT', 409, 'Refresh this message before changing its reaction.');
}
export function buildInteractionChangesQuery(id: string, query: InteractionChangesQuery) {
  return sql`select message_id as "messageId", revision::float8 as revision from message_interaction_events
    where conversation_id = ${id}::uuid and revision > ${query.afterRevision}
    order by revision asc limit ${query.limit + 1}`;
}
export async function readMessageContexts(
  tx: ChatTransaction,
  id: string,
  ids: string[],
  features: InteractionFeatures,
) {
  const idsSQL = sql.join(
    ids.map((value) => sql`${value}::uuid`),
    sql`, `,
  );
  const rows = (
    await tx.execute<
      {
        messageId: string;
        targetId: string | null;
        senderId: string | null;
        excerpt: string | null;
      } & Record<string, unknown>
    >(sql`
    select m.id as "messageId", ${features.repliesEnabled ? sql`target.id as "targetId", target.sender_id as "senderId", left(target.body, 120) as excerpt` : sql`null::uuid as "targetId", null::uuid as "senderId", null::text as excerpt`}
    from messages m ${features.repliesEnabled ? sql`left join message_replies r on r.message_id = m.id and r.conversation_id = m.conversation_id left join messages target on target.id = r.reply_to_message_id and target.conversation_id = m.conversation_id` : sql``}
    where m.conversation_id = ${id}::uuid and m.id in (${idsSQL})
  `)
  ).rows;
  const data: MessageContext[] = rows.map((row) => ({
    messageId: row.messageId,
    revision: 0,
    replyTo:
      row.targetId === null
        ? null
        : { messageId: row.targetId, senderId: row.senderId!, excerpt: row.excerpt! },
    reactions: [],
  }));
  if (!features.reactionsEnabled) return { data, revision: 0 };
  const reactions = (
    await tx.execute<
      {
        messageId: string;
        userId: string;
        reaction: ReactionKind | null;
        revision: number;
        changedRevision: number;
      } & Record<string, unknown>
    >(
      sql`select message_id as "messageId", user_id as "userId", kind as reaction, revision::float8 as revision, changed_revision::float8 as "changedRevision" from message_reactions where conversation_id = ${id}::uuid and message_id in (${idsSQL}) order by user_id`,
    )
  ).rows;
  const byId = new Map(data.map((context) => [context.messageId, context]));
  for (const state of reactions) {
    const context = byId.get(state.messageId);
    if (context !== undefined) {
      context.revision = Math.max(context.revision, state.changedRevision);
      context.reactions.push({
        userId: state.userId,
        reaction: state.reaction,
        revision: state.revision,
      });
    }
  }
  const counter = (
    await tx.execute<{ revision: number } & Record<string, unknown>>(
      sql`select revision::float8 as revision from conversation_interactions where conversation_id = ${id}::uuid`,
    )
  ).rows[0];
  return { data, revision: counter?.revision ?? 0 };
}

export async function writeReaction(
  tx: ChatTransaction,
  viewerId: string,
  id: string,
  messageId: string,
  input: SetMessageReaction,
) {
  const target = (
    await tx.execute(
      sql`select id from messages where conversation_id = ${id}::uuid and id = ${messageId}::uuid`,
    )
  ).rows[0];
  if (target === undefined)
    throw new DiscoveryError('NOT_FOUND', 404, 'This message is no longer available.');
  const current =
    (
      await tx.execute<
        { reaction: ReactionKind | null; revision: number } & Record<string, unknown>
      >(
        sql`select kind as reaction, revision::float8 as revision from message_reactions where conversation_id = ${id}::uuid and message_id = ${messageId}::uuid and user_id = ${viewerId}::uuid`,
      )
    ).rows[0] ?? null;
  if (!reactionNeedsWrite(current, input)) return;
  const count =
    (
      await tx.execute<{ count: number } & Record<string, unknown>>(
        sql`select count(*)::integer as count from message_interaction_events where actor_id = ${viewerId}::uuid and created_at > clock_timestamp() - interval '1 minute'`,
      )
    ).rows[0]?.count ?? 0;
  if (count >= 60)
    throw new DiscoveryError(
      'RATE_LIMITED',
      429,
      'Take a moment before changing another reaction.',
    );
  const counter = (
    await tx.execute<{ revision: number } & Record<string, unknown>>(
      sql`insert into conversation_interactions(conversation_id,revision) values (${id}::uuid,1) on conflict(conversation_id) do update set revision = conversation_interactions.revision + 1 returning revision::float8 as revision`,
    )
  ).rows[0];
  if (counter === undefined) throw new Error('Reaction revision persistence failed.');
  await tx.execute(
    sql`insert into message_reactions(conversation_id,message_id,user_id,kind,revision,changed_revision) values (${id}::uuid,${messageId}::uuid,${viewerId}::uuid,${input.reaction},${(current?.revision ?? 0) + 1},${counter.revision}) on conflict(message_id,user_id) do update set kind = excluded.kind, revision = excluded.revision, changed_revision = excluded.changed_revision`,
  );
  await tx.execute(
    sql`insert into message_interaction_events(conversation_id,revision,message_id,actor_id) values (${id}::uuid,${counter.revision},${messageId}::uuid,${viewerId}::uuid)`,
  );
}
