import { createHash, timingSafeEqual } from 'node:crypto';
import type {
  NotificationDeviceRegister,
  NotificationDeviceRevoke,
  NotificationDeviceReceipt,
} from '@pro-date/contracts';
import { sql } from 'drizzle-orm';
import type { ProDateDatabase } from './client.js';
import { DiscoveryError } from './discovery-repository.js';

type Transaction = Parameters<Parameters<ProDateDatabase['transaction']>[0]>[0];
type Action = 'REGISTER' | 'REVOKE';
export interface DeviceBinding extends Record<string, unknown> {
  installationId: string;
  ownerId: string;
  secretHash: string;
  generation: number;
  token: string | null;
  platform: string;
  projectId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastOperationId: string;
  lastRequestHash: string;
  updatedAt: Date;
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const conflict = () =>
  new DiscoveryError(
    'CONFLICT',
    409,
    'Device registration changed. Refresh this installation before retrying.',
  );

/** Internal policy, after the external contract has been validated. */
export function decideDeviceOperation(
  row: DeviceBinding | null,
  ownerId: string,
  secretHash: string,
  requestHash: string,
  input: NotificationDeviceRevoke,
  action: Action,
): 'CREATE' | 'WRITE' | 'REPLAY' {
  if (row === null) {
    if (action !== 'REGISTER' || input.expectedVersion !== 0) throw conflict();
    return 'CREATE';
  }
  // Both buffers are SHA-256 hashes. Source: https://nodejs.org/download/release/v24.14.0/docs/api/crypto.html#cryptotimingsafeequala-b
  if (!timingSafeEqual(Buffer.from(row.secretHash, 'hex'), Buffer.from(secretHash, 'hex')))
    throw conflict();
  if (row.lastOperationId === input.operationId) {
    if (row.ownerId !== ownerId || row.lastRequestHash !== requestHash) throw conflict();
    return 'REPLAY';
  }
  if (row.generation !== input.expectedVersion || (action === 'REVOKE' && row.ownerId !== ownerId))
    throw conflict();
  return 'WRITE';
}

function tokenConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'notification_devices_active_token_unique'
  )
    return true;
  return (
    'cause' in error &&
    error.cause !== error &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'code' in error.cause &&
    error.cause.code === '23505' &&
    'constraint' in error.cause &&
    error.cause.constraint === 'notification_devices_active_token_unique'
  );
}

export function createNotificationDeviceRepository(
  database: ProDateDatabase | Transaction,
  now = () => new Date(),
) {
  async function change(
    ownerId: string,
    installationId: string,
    input: NotificationDeviceRegister | NotificationDeviceRevoke,
    action: Action,
  ): Promise<NotificationDeviceReceipt> {
    const secretHash = digest(input.bindingSecret);
    const registration = action === 'REGISTER' ? (input as NotificationDeviceRegister) : null;
    // Explicit canonical fields, independent of JSON property order. Never store the raw binding proof.
    const requestHash = digest(
      JSON.stringify({
        ownerId,
        installationId,
        action,
        secretHash,
        operationId: input.operationId,
        expectedVersion: input.expectedVersion,
        token: registration?.token ?? null,
        platform: registration?.platform ?? null,
        projectId: registration?.projectId ?? null,
      }),
    );
    try {
      return await database.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('lock_timeout', '5s', true), set_config('statement_timeout', '10s', true)`,
        );
        // User before device: matches message/safety lock order. Serializes the account device cap.
        await tx.execute(sql`select id from users where id = ${ownerId}::uuid for update`);
        // A row lock cannot protect an absent installation. Hash collisions only serialize unrelated operations.
        // Source: https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS
        await tx.execute(sql`select pg_advisory_xact_lock(16909060, hashtext(${installationId}))`);
        const [row] = (
          await tx.execute<DeviceBinding>(sql`select installation_id as "installationId", owner_id as "ownerId", secret_hash as "secretHash",
          generation, token, platform, project_id as "projectId", expires_at as "expiresAt", revoked_at as "revokedAt",
          last_operation_id as "lastOperationId", last_request_hash as "lastRequestHash", updated_at as "updatedAt"
          from notification_devices where installation_id = ${installationId}::uuid for update`)
        ).rows;
        const decision = decideDeviceOperation(
          row ?? null,
          ownerId,
          secretHash,
          requestHash,
          input,
          action,
        );
        const at = now();
        if (decision === 'REPLAY')
          return {
            installationId,
            version: row!.generation,
            isRegistered: row!.token !== null && row!.revokedAt === null && row!.expiresAt > at,
          };
        const version = (row?.generation ?? 0) + 1;
        if (version > 2147483647) throw conflict();
        if (registration !== null) {
          const [count] = (
            await tx.execute<
              { count: number } & Record<string, unknown>
            >(sql`select count(*)::integer as count from notification_devices
            where owner_id = ${ownerId}::uuid and installation_id <> ${installationId}::uuid and token is not null
            and revoked_at is null and expires_at > ${at}`)
          ).rows;
          if (count === undefined) throw new Error('Device eligibility could not be established.');
          if (count.count >= 5)
            throw new DiscoveryError(
              'CONFLICT',
              409,
              'Five devices are already registered. Revoke one before adding another.',
            );
          const unchanged =
            row !== undefined &&
            row.ownerId === ownerId &&
            row.token === registration.token &&
            row.platform === registration.platform &&
            row.projectId === registration.projectId &&
            row.revokedAt === null &&
            row.expiresAt > at &&
            at.getTime() - row.updatedAt.getTime() < 86400000;
          const expiresAt = unchanged ? row.expiresAt : new Date(at.getTime() + 30 * 86400000);
          if (decision === 'CREATE') {
            await tx.execute(sql`insert into notification_devices (installation_id, owner_id, secret_hash, generation, token, platform, project_id,
              expires_at, revoked_at, last_operation_id, last_request_hash, updated_at)
              values (${installationId}::uuid, ${ownerId}::uuid, ${secretHash}, ${version}, ${registration.token}, ${registration.platform},
              ${registration.projectId}::uuid, ${expiresAt}, null, ${input.operationId}::uuid, ${requestHash}, ${at})`);
          } else {
            await tx.execute(sql`update notification_devices set owner_id = ${ownerId}::uuid, generation = ${version}, token = ${registration.token},
              platform = ${registration.platform}, project_id = ${registration.projectId}::uuid, expires_at = ${expiresAt}, revoked_at = null,
              last_operation_id = ${input.operationId}::uuid, last_request_hash = ${requestHash}, updated_at = ${unchanged ? row.updatedAt : at}
              where installation_id = ${installationId}::uuid`);
          }
        } else {
          await tx.execute(sql`update notification_devices set token = null, generation = ${version}, revoked_at = ${at}, expires_at = ${at},
            last_operation_id = ${input.operationId}::uuid, last_request_hash = ${requestHash}, updated_at = ${at}
            where installation_id = ${installationId}::uuid`);
        }
        if (row !== undefined)
          await tx.execute(sql`update message_notification_jobs set status = 'CANCELLED', terminal_at = ${at}, claim_id = null, leased_until = null
          where device_id = ${installationId}::uuid and status in ('PENDING', 'LEASED')`);
        return { installationId, version, isRegistered: registration !== null };
      });
    } catch (error: unknown) {
      if (tokenConflict(error)) throw conflict();
      throw error;
    }
  }
  return {
    register: (ownerId: string, installationId: string, input: NotificationDeviceRegister) =>
      change(ownerId, installationId, input, 'REGISTER'),
    revoke: (ownerId: string, installationId: string, input: NotificationDeviceRevoke) =>
      change(ownerId, installationId, input, 'REVOKE'),
  };
}
export type NotificationDeviceRepository = ReturnType<typeof createNotificationDeviceRepository>;
