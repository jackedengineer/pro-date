import { asc, eq, sql } from 'drizzle-orm';
import type { ProDateDatabase } from './client.js';
import { requireConversationAccess } from './messaging-repository.js';
import { users } from './schema.js';

type Transaction = Parameters<Parameters<ProDateDatabase['transaction']>[0]>[0];
type Settings = { isPaused: boolean; revision: number } & Record<string, unknown>;
type Preference = { isEnabled: boolean; revision: number } & Record<string, unknown>;
const emptySettings: Settings = { isPaused: false, revision: 0 };
const emptyPreference: Preference = { isEnabled: false, revision: 0 };

export function buildNotificationSettingsUpdate(ownerId: string, isPaused: boolean) {
  return sql`insert into notification_settings (user_id, is_paused) values (${ownerId}::uuid, ${isPaused})
    on conflict (user_id) do update set is_paused = excluded.is_paused,
    revision = notification_settings.revision + case when notification_settings.is_paused is distinct from excluded.is_paused then 1 else 0 end
    returning is_paused as "isPaused", revision`;
}
export function buildConversationNotificationUpdate(
  ownerId: string,
  conversationId: string,
  isEnabled: boolean,
) {
  return sql`insert into conversation_notification_preferences (user_id, conversation_id, is_enabled)
    values (${ownerId}::uuid, ${conversationId}::uuid, ${isEnabled})
    on conflict (conversation_id, user_id) do update set is_enabled = excluded.is_enabled,
    revision = conversation_notification_preferences.revision + case when conversation_notification_preferences.is_enabled is distinct from excluded.is_enabled then 1 else 0 end
    returning is_enabled as "isEnabled", revision`;
}
export function buildCancelNotificationJobs(ownerId: string, conversationId?: string) {
  // Receipt work for ACCEPTED attempts is deliberately untouched.
  return sql`update message_notification_jobs set status = 'CANCELLED', terminal_at = clock_timestamp(), claim_id = null, leased_until = null
    where recipient_id = ${ownerId}::uuid and status in ('PENDING', 'LEASED')
    ${conversationId === undefined ? sql`` : sql`and message_id in (select id from messages where conversation_id = ${conversationId}::uuid)`}`;
}
async function readSettings(db: ProDateDatabase | Transaction, ownerId: string) {
  const [row] = (
    await db.execute<Settings>(
      sql`select is_paused as "isPaused", revision from notification_settings where user_id = ${ownerId}::uuid`,
    )
  ).rows;
  return row ?? { ...emptySettings };
}
async function readPreference(tx: Transaction, ownerId: string, conversationId: string) {
  const [row] = (
    await tx.execute<Preference>(sql`select is_enabled as "isEnabled", revision from conversation_notification_preferences
    where user_id = ${ownerId}::uuid and conversation_id = ${conversationId}::uuid`)
  ).rows;
  return row ?? { ...emptyPreference };
}
export function createNotificationPreferencesRepository(database: ProDateDatabase | Transaction) {
  return {
    settings: (ownerId: string) => readSettings(database, ownerId),
    async saveSettings(this: void, ownerId: string, isPaused: boolean) {
      return database.transaction(async (tx) => {
        // Same user-lock ordering as message sends and safety changes; no provider call in this transaction.
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, ownerId))
          .orderBy(asc(users.id))
          .for('update');
        const previous = await readSettings(tx, ownerId);
        const [changed] =
          previous.revision === 0 && !isPaused
            ? [previous]
            : (await tx.execute<Settings>(buildNotificationSettingsUpdate(ownerId, isPaused))).rows;
        if (isPaused) await tx.execute(buildCancelNotificationJobs(ownerId));
        if (changed === undefined) throw new Error('Notification settings were not persisted.');
        return changed;
      });
    },
    async conversation(this: void, ownerId: string, conversationId: string) {
      return database.transaction(async (tx) => {
        await requireConversationAccess(tx, ownerId, conversationId, false);
        return readPreference(tx, ownerId, conversationId);
      });
    },
    async saveConversation(
      this: void,
      ownerId: string,
      conversationId: string,
      isEnabled: boolean,
    ) {
      return database.transaction(async (tx) => {
        await requireConversationAccess(tx, ownerId, conversationId, true);
        const previous = await readPreference(tx, ownerId, conversationId);
        const [changed] =
          previous.revision === 0 && !isEnabled
            ? [previous]
            : (
                await tx.execute<Preference>(
                  buildConversationNotificationUpdate(ownerId, conversationId, isEnabled),
                )
              ).rows;
        if (!isEnabled) await tx.execute(buildCancelNotificationJobs(ownerId, conversationId));
        if (changed === undefined)
          throw new Error('Conversation notification preference was not persisted.');
        return changed;
      });
    },
  };
}
export type NotificationPreferencesRepository = ReturnType<
  typeof createNotificationPreferencesRepository
>;
