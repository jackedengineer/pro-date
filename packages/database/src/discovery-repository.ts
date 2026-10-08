import type {
  DiscoveryProfile,
  DiscoveryQuery,
  InboxQuery,
  PullRequestReceipt,
  ReportProfile,
  SendPullRequest,
} from '@pro-date/contracts';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { ProDateDatabase } from './client.js';
import {
  matches,
  profilePasses,
  profilePhotos,
  profilePromptAnswers,
  profileReports,
  pullRequests,
  userBlocks,
  users,
} from './schema.js';

export class DiscoveryError extends Error {
  constructor(
    readonly code:
      'NOT_FOUND' | 'CONFLICT' | 'INVALID_CURSOR' | 'RATE_LIMITED' | 'VALIDATION_ERROR',
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

export interface PagePosition {
  ceiling: string;
  at?: string;
  id?: string;
}
export interface PublicProfileRecord
  extends Omit<DiscoveryProfile, 'photos' | 'prompts'>, Record<string, unknown> {
  cursorAt: string;
}
export interface IncomingRequestRecord extends PublicProfileRecord {
  requestId: string;
  requestAt: string;
  comment: string;
  targetType: 'PHOTO' | 'PROMPT';
  targetId: string;
  photoPublicId: string | null;
  photoVersion: number | null;
  promptId: string | null;
  promptAnswer: string | null;
}
export interface MatchRecord extends PublicProfileRecord {
  matchId: string;
  matchAt: string;
}

const publicSelection = sql`
  p.user_id as "userId", p.display_name as "displayName",
  date_part('year', age(current_date, p.birth_date))::integer as age,
  concat_ws(', ', p.location_locality, nullif(p.location_region, p.location_locality)) as "locationLabel",
  case when p.is_gender_visible then p.gender_identity else null end as "genderIdentity",
  case when p.are_pronouns_visible then p.pronouns else null end as pronouns,
  case when p.is_height_visible then p.height_cm else null end as "heightCm",
  p.relationship_intent as "relationshipIntent",
  to_char(p.published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "cursorAt"`;

function publicAvailability(viewerId: string) {
  return sql`p.user_id <> ${viewerId}::uuid and p.published_at is not null
    and u.onboarding_status = 'COMPLETE' and p.display_name is not null
    and p.birth_date <= current_date - interval '18 years'
    and p.gender_identity is not null and p.relationship_intent is not null
    and p.location is not null and p.location_locality is not null
    and (select count(*) from profile_photos ph where ph.user_id = p.user_id) >= 4
    and (select count(*) from profile_prompt_answers pa where pa.user_id = p.user_id) = 3
    and not exists (select 1 from user_blocks b where
      (b.user_id = ${viewerId}::uuid and b.blocked_user_id = p.user_id) or
      (b.blocked_user_id = ${viewerId}::uuid and b.user_id = p.user_id))`;
}

// Do not guess a dating category from an arbitrary self-description.
// Custom/questioning identities are eligible when the other member selects every audience.
function audience(identity: ReturnType<typeof sql>, preferences: ReturnType<typeof sql>) {
  return sql`(case lower(${identity}) when 'woman' then 'WOMEN' when 'man' then 'MEN'
    when 'non-binary' then 'NON_BINARY_PEOPLE' when 'genderfluid' then 'NON_BINARY_PEOPLE'
    when 'agender' then 'NON_BINARY_PEOPLE' else null end = any(${preferences})
    or ${preferences} @> ARRAY['WOMEN', 'MEN', 'NON_BINARY_PEOPLE']::varchar[])`;
}

function discoveryEligibility(viewerId: string, query: DiscoveryQuery) {
  return sql`${publicAvailability(viewerId)}
    and viewer.published_at is not null
    and p.birth_date <= current_date - make_interval(years => ${query.minAge})
    and p.birth_date > current_date - make_interval(years => ${query.maxAge + 1})
    and ST_DWithin(p.location, viewer.location, ${query.radiusKm * 1000})
    and ${audience(sql`p.gender_identity`, sql`viewer.interested_in`)}
    and ${audience(sql`viewer.gender_identity`, sql`p.interested_in`)}
    and not exists (select 1 from profile_passes ps where ps.user_id = ${viewerId}::uuid and ps.passed_user_id = p.user_id)
    and not exists (select 1 from pull_requests pr where
      (pr.sender_user_id = ${viewerId}::uuid and pr.recipient_user_id = p.user_id) or
      (pr.recipient_user_id = ${viewerId}::uuid and pr.sender_user_id = p.user_id))
    and not exists (select 1 from matches m where
      (m.first_user_id = ${viewerId}::uuid and m.second_user_id = p.user_id) or
      (m.second_user_id = ${viewerId}::uuid and m.first_user_id = p.user_id))`;
}

export function buildDiscoveryQuery(
  viewerId: string,
  query: DiscoveryQuery,
  position: PagePosition,
) {
  return sql`select ${publicSelection} from profiles p join users u on u.id = p.user_id
    join profiles viewer on viewer.user_id = ${viewerId}::uuid
    where ${discoveryEligibility(viewerId, query)} and p.published_at <= ${position.ceiling}::timestamptz
    ${position.at === undefined ? sql`` : sql`and (p.published_at, p.user_id) < (${position.at}::timestamptz, ${position.id}::uuid)`}
    order by p.published_at desc, p.user_id desc limit ${query.limit + 1}`;
}

export function buildPublicProfilesQuery(viewerId: string, userIds: string[]) {
  return sql`select ${publicSelection} from profiles p join users u on u.id = p.user_id
    where ${publicAvailability(viewerId)} and p.user_id in (${sql.join(
      userIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`;
}

type Transaction = Parameters<Parameters<ProDateDatabase['transaction']>[0]>[0];

async function lockPair(transaction: Transaction, firstId: string, secondId: string) {
  if (firstId === secondId) throw new DiscoveryError('CONFLICT', 409, 'Choose another member.');
  const pair = await transaction
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, [firstId, secondId]))
    .orderBy(asc(users.id))
    .for('update');
  if (pair.length !== 2) throw new DiscoveryError('NOT_FOUND', 404, 'This profile is unavailable.');
}

async function requirePublicPair(transaction: Transaction, viewerId: string, otherId: string) {
  const result = await transaction.execute<PublicProfileRecord>(
    buildPublicProfilesQuery(viewerId, [otherId]),
  );
  const viewer = await transaction.execute(
    sql`select 1 from profiles where user_id = ${viewerId}::uuid and published_at is not null`,
  );
  if (result.rows.length === 0 || viewer.rows.length === 0)
    throw new DiscoveryError('NOT_FOUND', 404, 'This profile is unavailable.');
}

async function receipt(
  transaction: Transaction,
  record: typeof pullRequests.$inferSelect,
): Promise<PullRequestReceipt> {
  const [first, second] = [record.senderUserId, record.recipientUserId].sort();
  const [match] = await transaction
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.firstUserId, first!), eq(matches.secondUserId, second!)))
    .limit(1);
  return { id: record.id, status: record.status, matchId: match?.id ?? null };
}

export function createDiscoveryRepository(database: ProDateDatabase | Transaction) {
  return {
    async browse(this: void, viewerId: string, query: DiscoveryQuery, position: PagePosition) {
      return (
        await database.execute<PublicProfileRecord>(buildDiscoveryQuery(viewerId, query, position))
      ).rows;
    },
    async media(this: void, userIds: string[]) {
      if (userIds.length === 0) return { photos: [], prompts: [] };
      const [photos, prompts] = await Promise.all([
        database
          .select()
          .from(profilePhotos)
          .where(inArray(profilePhotos.userId, userIds))
          .orderBy(asc(profilePhotos.position)),
        database
          .select()
          .from(profilePromptAnswers)
          .where(inArray(profilePromptAnswers.userId, userIds))
          .orderBy(asc(profilePromptAnswers.position)),
      ]);
      return { photos, prompts };
    },
    async inbox(this: void, viewerId: string, query: InboxQuery, position: PagePosition) {
      return (
        await database.execute<IncomingRequestRecord>(sql`select ${publicSelection},
        pr.id as "requestId", to_char(pr.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "requestAt",
        pr.comment, pr.target_type as "targetType", pr.target_id as "targetId",
        pr.photo_public_id as "photoPublicId", pr.photo_version::float8 as "photoVersion",
        pr.prompt_id as "promptId", pr.prompt_answer as "promptAnswer"
        from pull_requests pr join profiles p on p.user_id = pr.sender_user_id join users u on u.id = p.user_id
        where pr.recipient_user_id = ${viewerId}::uuid and pr.status = 'PENDING' and ${publicAvailability(viewerId)}
        and pr.created_at <= ${position.ceiling}::timestamptz
        ${position.at === undefined ? sql`` : sql`and (pr.created_at, pr.id) < (${position.at}::timestamptz, ${position.id}::uuid)`}
        order by pr.created_at desc, pr.id desc limit ${query.limit + 1}`)
      ).rows;
    },
    async listMatches(this: void, viewerId: string, query: InboxQuery, position: PagePosition) {
      return (
        await database.execute<MatchRecord>(sql`select ${publicSelection}, m.id as "matchId",
        to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "matchAt"
        from matches m join profiles p on p.user_id = case when m.first_user_id = ${viewerId}::uuid then m.second_user_id else m.first_user_id end
        join users u on u.id = p.user_id
        where (m.first_user_id = ${viewerId}::uuid or m.second_user_id = ${viewerId}::uuid) and m.unmatched_at is null and ${publicAvailability(viewerId)}
        and m.created_at <= ${position.ceiling}::timestamptz
        ${position.at === undefined ? sql`` : sql`and (m.created_at, m.id) < (${position.at}::timestamptz, ${position.id}::uuid)`}
        order by m.created_at desc, m.id desc limit ${query.limit + 1}`)
      ).rows;
    },
    async send(this: void, viewerId: string, input: SendPullRequest): Promise<PullRequestReceipt> {
      return database.transaction(async (transaction) => {
        await lockPair(transaction, viewerId, input.recipientUserId);
        await requirePublicPair(transaction, viewerId, input.recipientUserId);
        const [existing] = await transaction
          .select()
          .from(pullRequests)
          .where(
            and(
              eq(pullRequests.senderUserId, viewerId),
              eq(pullRequests.recipientUserId, input.recipientUserId),
            ),
          )
          .limit(1);
        if (existing !== undefined) {
          if (
            existing.targetId !== input.targetId ||
            existing.targetType !== input.targetType ||
            existing.comment !== input.comment
          )
            throw new DiscoveryError(
              'CONFLICT',
              409,
              'You already sent this member a pull request.',
            );
          return receipt(transaction, existing);
        }
        // Revalidate server-owned eligibility at mutation time, including reciprocal preferences.
        const eligible =
          await transaction.execute(sql`select 1 from profiles p join users u on u.id = p.user_id
          join profiles viewer on viewer.user_id = ${viewerId}::uuid where p.user_id = ${input.recipientUserId}::uuid
          and ${discoveryEligibility(viewerId, { limit: 1, minAge: 18, maxAge: 99, radiusKm: 200 })}`);
        if (eligible.rows.length === 0)
          throw new DiscoveryError('NOT_FOUND', 404, 'This profile is no longer available.');
        const daily = await transaction.execute<{ count: number }>(
          sql`select count(*)::integer as count from pull_requests where sender_user_id = ${viewerId}::uuid and created_at > now() - interval '24 hours'`,
        );
        if ((daily.rows[0]?.count ?? 0) >= 30)
          throw new DiscoveryError(
            'RATE_LIMITED',
            429,
            'You have reached today’s pull request limit. Try again tomorrow.',
          );
        const photo =
          input.targetType === 'PHOTO'
            ? (
                await transaction
                  .select()
                  .from(profilePhotos)
                  .where(
                    and(
                      eq(profilePhotos.id, input.targetId),
                      eq(profilePhotos.userId, input.recipientUserId),
                    ),
                  )
                  .limit(1)
              )[0]
            : undefined;
        const prompt =
          input.targetType === 'PROMPT'
            ? (
                await transaction
                  .select()
                  .from(profilePromptAnswers)
                  .where(
                    and(
                      eq(profilePromptAnswers.id, input.targetId),
                      eq(profilePromptAnswers.userId, input.recipientUserId),
                    ),
                  )
                  .limit(1)
              )[0]
            : undefined;
        if (photo === undefined && prompt === undefined)
          throw new DiscoveryError(
            'NOT_FOUND',
            404,
            'That photo or prompt changed. Refresh this profile.',
          );
        const [record] = await transaction
          .insert(pullRequests)
          .values({
            senderUserId: viewerId,
            recipientUserId: input.recipientUserId,
            targetType: input.targetType,
            targetId: input.targetId,
            comment: input.comment,
            photoPublicId: photo?.providerPublicId ?? null,
            photoVersion: photo?.providerVersion ?? null,
            promptId: prompt?.promptId ?? null,
            promptAnswer: prompt?.answer ?? null,
          })
          .returning();
        if (record === undefined) throw new Error('Pull request persistence failed.');
        return receipt(transaction, record);
      });
    },
    async respond(
      this: void,
      viewerId: string,
      requestId: string,
      decision: 'MERGED' | 'DECLINED',
    ): Promise<PullRequestReceipt> {
      return database.transaction(async (transaction) => {
        const [initial] = await transaction
          .select()
          .from(pullRequests)
          .where(and(eq(pullRequests.id, requestId), eq(pullRequests.recipientUserId, viewerId)))
          .limit(1);
        if (initial === undefined)
          throw new DiscoveryError('NOT_FOUND', 404, 'This pull request is unavailable.');
        await lockPair(transaction, viewerId, initial.senderUserId);
        await requirePublicPair(transaction, viewerId, initial.senderUserId);
        const [record] = await transaction
          .select()
          .from(pullRequests)
          .where(eq(pullRequests.id, requestId))
          .for('update');
        if (record === undefined)
          throw new DiscoveryError('NOT_FOUND', 404, 'This pull request is unavailable.');
        if (record.status !== 'PENDING') {
          if (record.status !== decision)
            throw new DiscoveryError(
              'CONFLICT',
              409,
              'This pull request has already been reviewed.',
            );
          return receipt(transaction, record);
        }
        if (decision === 'MERGED') {
          const [first, second] = [viewerId, record.senderUserId].sort();
          await transaction
            .insert(matches)
            .values({ firstUserId: first!, secondUserId: second! })
            .onConflictDoNothing();
          // Resolve any reverse request as part of the same accepted connection.
          await transaction
            .update(pullRequests)
            .set({ status: 'MERGED', respondedAt: sql`now()` })
            .where(
              and(
                eq(pullRequests.senderUserId, viewerId),
                eq(pullRequests.recipientUserId, record.senderUserId),
                eq(pullRequests.status, 'PENDING'),
              ),
            );
        }
        await transaction
          .update(pullRequests)
          .set({ status: decision, respondedAt: sql`now()` })
          .where(eq(pullRequests.id, requestId));
        return receipt(transaction, { ...record, status: decision });
      });
    },
    async pass(this: void, viewerId: string, otherId: string) {
      await database.transaction(async (transaction) => {
        await lockPair(transaction, viewerId, otherId);
        await requirePublicPair(transaction, viewerId, otherId);
        await transaction
          .insert(profilePasses)
          .values({ userId: viewerId, passedUserId: otherId })
          .onConflictDoNothing();
      });
    },
    async block(this: void, viewerId: string, otherId: string) {
      await database.transaction(async (transaction) => {
        await lockPair(transaction, viewerId, otherId);
        await transaction
          .insert(userBlocks)
          .values({ userId: viewerId, blockedUserId: otherId })
          .onConflictDoNothing();
      });
    },
    async report(this: void, viewerId: string, input: ReportProfile) {
      await database.transaction(async (transaction) => {
        await lockPair(transaction, viewerId, input.userId);
        const [existing] = await transaction
          .select()
          .from(profileReports)
          .where(
            and(
              eq(profileReports.reporterUserId, viewerId),
              eq(profileReports.reportedUserId, input.userId),
            ),
          )
          .limit(1);
        if (
          existing !== undefined &&
          (existing.reason !== input.reason || existing.details !== input.details)
        )
          throw new DiscoveryError('CONFLICT', 409, 'You have already reported this member.');
        await transaction
          .insert(profileReports)
          .values({
            reporterUserId: viewerId,
            reportedUserId: input.userId,
            reason: input.reason,
            details: input.details,
          })
          .onConflictDoNothing();
        await transaction
          .insert(userBlocks)
          .values({ userId: viewerId, blockedUserId: input.userId })
          .onConflictDoNothing();
      });
    },
  };
}

export type DiscoveryRepository = ReturnType<typeof createDiscoveryRepository>;
