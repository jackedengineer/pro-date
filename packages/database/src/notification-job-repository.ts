import type { ChatNotificationPayload } from '@pro-date/contracts';
import { sql } from 'drizzle-orm';
import type { ProDateDatabase } from './client.js';

type Transaction = Parameters<Parameters<ProDateDatabase['transaction']>[0]>[0];
export interface NotificationClaim extends Record<string, unknown> {
  id: string;
  claimId: string;
}
interface NotificationEligibility extends Record<string, unknown> {
  jobId: string;
  claimId: string;
  attemptNumber: number;
  deviceId: string;
  deviceGeneration: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}
export interface NotificationAttempt extends NotificationEligibility {
  attemptId: string;
  payload: ChatNotificationPayload;
}
interface EligibleNotification extends NotificationEligibility {
  messageId: string;
  conversationId: string;
  recipientId: string;
}
export interface NotificationCompletion {
  outcome: 'ACCEPTED' | 'RETRYABLE' | 'UNKNOWN' | 'FAILED';
  errorCode: string | null;
  ticketId?: string;
  nextAttemptAt: Date;
}

/** Called only for the first message insert, inside the same transaction and ordered member locks. */
export function buildEnqueueNotifications(
  messageId: string,
  recipientId: string,
  projectId: string,
) {
  return sql`insert into message_notification_jobs
    (message_id, device_id, recipient_id, settings_revision, preference_revision, device_generation, expires_at)
    select msg.id, d.installation_id, ${recipientId}::uuid, coalesce(s.revision, 0), p.revision, d.generation,
      clock_timestamp() + interval '24 hours'
    from messages msg
    join conversation_notification_preferences p on p.conversation_id = msg.conversation_id and p.user_id = ${recipientId}::uuid and p.is_enabled
    join notification_devices d on d.owner_id = p.user_id and d.project_id = ${projectId}::uuid
    left join notification_settings s on s.user_id = p.user_id
    where msg.id = ${messageId}::uuid and msg.sender_id <> p.user_id
    and coalesce(s.is_paused, false) = false and d.token is not null and d.revoked_at is null and d.expires_at > clock_timestamp()
    on conflict (message_id, device_id) do nothing`;
}

// The queue is not an authorization grant. Re-evaluate all snapshots immediately before each handoff.
export function buildNotificationEligibility(jobId: string, claimId: string, projectId: string) {
  return sql`select j.id as "jobId", j.claim_id as "claimId", j.attempt_count as "attemptNumber",
    j.device_id as "deviceId", j.device_generation as "deviceGeneration", d.token,
    j.expires_at as "expiresAt", j.created_at as "createdAt",
    msg.id as "messageId", msg.conversation_id as "conversationId", j.recipient_id as "recipientId"
    from message_notification_jobs j join messages msg on msg.id = j.message_id
    join matches m on m.id = msg.conversation_id
    join users recipient on recipient.id = j.recipient_id and recipient.onboarding_status = 'COMPLETE'
    join users sender on sender.id = msg.sender_id and sender.onboarding_status = 'COMPLETE'
    join notification_devices d on d.installation_id = j.device_id and d.owner_id = j.recipient_id
    join conversation_notification_preferences p on p.conversation_id = m.id and p.user_id = j.recipient_id
    left join notification_settings s on s.user_id = j.recipient_id
    where j.id = ${jobId}::uuid and j.claim_id = ${claimId}::uuid and j.status = 'LEASED'
    and j.leased_until > clock_timestamp() and j.expires_at > clock_timestamp()
    and j.device_generation = d.generation and d.project_id = ${projectId}::uuid
    and d.token is not null and d.revoked_at is null and d.expires_at > clock_timestamp()
    and p.is_enabled and p.revision = j.preference_revision
    and coalesce(s.is_paused, false) = false and coalesce(s.revision, 0) = j.settings_revision
    and m.unmatched_at is null and msg.sender_id <> j.recipient_id
    and ((m.first_user_id = msg.sender_id and m.second_user_id = j.recipient_id)
      or (m.second_user_id = msg.sender_id and m.first_user_id = j.recipient_id))
    and not exists (select 1 from user_blocks b where
      (b.user_id = m.first_user_id and b.blocked_user_id = m.second_user_id)
      or (b.user_id = m.second_user_id and b.blocked_user_id = m.first_user_id))`;
}

export function createNotificationJobRepository(
  database: ProDateDatabase | Transaction,
  projectId: string,
) {
  return {
    async claim() {
      // Four concurrent sends stay well inside the 60-second lease and Expo's project rate budget.
      // https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE
      return (
        await database.execute<NotificationClaim>(sql`with due as (
        select id from message_notification_jobs where expires_at > clock_timestamp() and attempt_count < 8
        and ((status = 'PENDING' and next_attempt_at <= clock_timestamp()) or (status = 'LEASED' and leased_until <= clock_timestamp()))
        order by next_attempt_at, id limit 4 for update skip locked
      ) update message_notification_jobs j set status = 'LEASED', claim_id = gen_random_uuid(),
        leased_until = clock_timestamp() + interval '60 seconds' from due where j.id = due.id
        returning j.id, j.claim_id as "claimId"`)
      ).rows;
    },
    async prepare(claim: NotificationClaim): Promise<NotificationAttempt | null> {
      return database.transaction(async (tx) => {
        const owned = (
          await tx.execute(sql`select id from message_notification_jobs where id = ${claim.id}::uuid
          and claim_id = ${claim.claimId}::uuid and status = 'LEASED' and leased_until > clock_timestamp() for update`)
        ).rows;
        if (owned.length === 0) return null;
        const [eligible] = (
          await tx.execute<EligibleNotification>(
            buildNotificationEligibility(claim.id, claim.claimId, projectId),
          )
        ).rows;
        if (eligible === undefined || eligible.attemptNumber >= 8) {
          await tx.execute(sql`update message_notification_jobs set status = 'CANCELLED', terminal_at = clock_timestamp(), claim_id = null,
            leased_until = null where id = ${claim.id}::uuid and claim_id = ${claim.claimId}::uuid`);
          return null;
        }
        await tx.execute(sql`update notification_attempts set outcome = 'UNKNOWN', error_code = 'NETWORK'
          where job_id = ${claim.id}::uuid and outcome = 'STARTED'`);
        const attemptNumber = eligible.attemptNumber + 1;
        await tx.execute(sql`update message_notification_jobs set attempt_count = ${attemptNumber},
          leased_until = clock_timestamp() + interval '60 seconds' where id = ${claim.id}::uuid`);
        const [attempt] = (
          await tx.execute<
            { id: string } & Record<string, unknown>
          >(sql`insert into notification_attempts (job_id, attempt_number)
          values (${claim.id}::uuid, ${attemptNumber}) returning id`)
        ).rows;
        if (attempt === undefined) throw new Error('Notification attempt was not persisted.');
        return {
          ...eligible,
          attemptNumber,
          attemptId: attempt.id,
          payload: {
            version: 1,
            type: 'CHAT_MESSAGE',
            conversationId: eligible.conversationId,
            messageId: eligible.messageId,
            recipientId: eligible.recipientId,
          },
        };
      });
    },
    async authorize(attempt: NotificationAttempt) {
      return (
        (
          await database.execute(sql`${buildNotificationEligibility(attempt.jobId, attempt.claimId, projectId)}
        and j.attempt_count = ${attempt.attemptNumber} and j.device_generation = ${attempt.deviceGeneration}`)
        ).rows.length > 0
      );
    },
    async finish(attempt: NotificationAttempt, result: NotificationCompletion) {
      await database.transaction(async (tx) => {
        // Match prepare's lock order. Even a cancelled/stale claim retains its accepted receipt for cleanup.
        await tx.execute(
          sql`select id from message_notification_jobs where id = ${attempt.jobId}::uuid for update`,
        );
        const accepted = result.outcome === 'ACCEPTED';
        await tx.execute(sql`update notification_attempts set outcome = ${result.outcome}, error_code = ${result.errorCode},
          ticket_id = ${result.ticketId ?? null}, receipt_status = ${accepted ? 'PENDING' : null},
          receipt_due_at = ${accepted ? sql`clock_timestamp() + interval '15 minutes'` : sql`null`},
          receipt_expires_at = ${accepted ? sql`clock_timestamp() + interval '23 hours'` : sql`null`}
          where id = ${attempt.attemptId}::uuid and outcome in ('STARTED', 'UNKNOWN') and ticket_id is null`);
        const terminal = accepted || result.outcome === 'FAILED' || attempt.attemptNumber >= 8;
        await tx.execute(sql`update message_notification_jobs set status = ${accepted ? 'ACCEPTED' : terminal ? 'FAILED' : 'PENDING'},
          next_attempt_at = ${result.nextAttemptAt}, terminal_at = ${terminal ? sql`clock_timestamp()` : sql`null`}, claim_id = null, leased_until = null
          where id = ${attempt.jobId}::uuid and claim_id = ${attempt.claimId}::uuid and status = 'LEASED'
          and leased_until > clock_timestamp() and attempt_count = ${attempt.attemptNumber}`);
      });
    },
    async retire(deviceId: string, generation: number) {
      await database.execute(sql`with retired as (
        update notification_devices set token = null, revoked_at = clock_timestamp(), expires_at = clock_timestamp()
        where installation_id = ${deviceId}::uuid and generation = ${generation} and token is not null returning installation_id
      ) update message_notification_jobs set status = 'CANCELLED', terminal_at = clock_timestamp(), claim_id = null, leased_until = null
        where device_id in (select installation_id from retired) and device_generation = ${generation} and status in ('PENDING', 'LEASED')`);
    },
    async housekeep() {
      // A process can die on its last permitted handoff. Preserve that uncertainty even when
      // no later attempt will reclaim the job. Never overwrite an already accepted ticket.
      await database.execute(sql`with abandoned as (
        select a.id from notification_attempts a join message_notification_jobs j on j.id = a.job_id
        where a.outcome = 'STARTED' and (j.status <> 'LEASED' or j.leased_until <= clock_timestamp())
        limit 100 for update of a skip locked
      ) update notification_attempts set outcome = 'UNKNOWN', error_code = 'NETWORK'
        where id in (select id from abandoned)`);
      await database.execute(sql`with expired as (
        select id from message_notification_jobs where status in ('PENDING', 'LEASED')
        and (expires_at <= clock_timestamp() or (attempt_count >= 8 and (leased_until is null or leased_until <= clock_timestamp())))
        limit 100 for update skip locked
      ) update message_notification_jobs j set status = 'EXPIRED', terminal_at = clock_timestamp(), claim_id = null, leased_until = null
        from expired where j.id = expired.id`);
      await database.execute(sql`with inactive as (
        select installation_id from notification_devices where token is not null and expires_at <= clock_timestamp() limit 100 for update skip locked
      ), retired as (
        update notification_devices d set token = null, revoked_at = clock_timestamp() from inactive where d.installation_id = inactive.installation_id returning d.installation_id
      ) update message_notification_jobs set status = 'CANCELLED', terminal_at = clock_timestamp(), claim_id = null, leased_until = null
        where device_id in (select installation_id from retired) and status in ('PENDING', 'LEASED')`);
      await database.execute(sql`with resolved as (
        select id from message_notification_jobs j where terminal_at < clock_timestamp() - interval '7 days'
        and not exists (select 1 from notification_attempts a where a.job_id = j.id and a.receipt_status = 'PENDING')
        limit 100 for update skip locked
      ) delete from message_notification_jobs where id in (select id from resolved)`);
    },
  };
}
export type NotificationJobRepository = ReturnType<typeof createNotificationJobRepository>;
