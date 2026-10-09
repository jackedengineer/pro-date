import { sql } from 'drizzle-orm';
import type { ProDateDatabase } from './client.js';
type Transaction = Parameters<Parameters<ProDateDatabase['transaction']>[0]>[0];

export interface NotificationReceiptWork extends Record<string, unknown> {
  attemptId: string;
  ticketId: string;
  deviceId: string;
  deviceGeneration: number;
  leaseUntil: Date;
  expiresAt: Date;
}
export function createNotificationReceiptRepository(database: ProDateDatabase | Transaction) {
  return {
    async claim() {
      return (
        await database.execute<NotificationReceiptWork>(sql`with due as (
        select id from notification_attempts where receipt_status = 'PENDING'
        and receipt_due_at <= clock_timestamp() and receipt_expires_at > clock_timestamp()
        order by receipt_due_at, id limit 4 for update skip locked
      ), claimed as (
        update notification_attempts a set receipt_due_at = date_trunc('milliseconds', clock_timestamp()) + interval '60 seconds'
        from due where a.id = due.id returning a.*
      ) select a.id as "attemptId", a.ticket_id as "ticketId", j.device_id as "deviceId", j.device_generation as "deviceGeneration",
        a.receipt_due_at as "leaseUntil", a.receipt_expires_at as "expiresAt"
        from claimed a join message_notification_jobs j on j.id = a.job_id`)
      ).rows;
    },
    async finish(
      work: NotificationReceiptWork,
      status: 'OK' | 'ERROR' | 'PENDING',
      code: string | null,
    ) {
      await database.execute(sql`update notification_attempts set receipt_status = ${status}, error_code = ${code},
        receipt_due_at = clock_timestamp() + interval '5 minutes'
        where id = ${work.attemptId}::uuid and receipt_status = 'PENDING' and receipt_due_at = ${work.leaseUntil}
        and receipt_expires_at > clock_timestamp()`);
    },
    async expire() {
      await database.execute(sql`with expired as (
        select id from notification_attempts where receipt_status = 'PENDING' and receipt_expires_at <= clock_timestamp()
        limit 100 for update skip locked
      ) update notification_attempts a set receipt_status = 'EXPIRED' from expired where a.id = expired.id`);
    },
  };
}
export type NotificationReceiptRepository = ReturnType<typeof createNotificationReceiptRepository>;
