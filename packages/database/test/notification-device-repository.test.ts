import { createHash } from 'node:crypto';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { ProDateDatabase } from '../src/client.js';
import {
  decideDeviceOperation,
  createNotificationDeviceRepository,
  type DeviceBinding,
} from '../src/notification-device-repository.js';

const owner = '10000000-0000-4000-8000-000000000001';
const installation = '10000000-0000-4000-8000-000000000002';
const operation = '10000000-0000-4000-8000-000000000003';
const nextOwner = '10000000-0000-4000-8000-000000000004';
const secret = 'a'.repeat(64);
const hash = createHash('sha256').update(secret).digest('hex');
const now = new Date('2026-10-09T12:00:00.000Z');
const input = {
  bindingSecret: secret,
  expectedVersion: 1,
  operationId: operation,
  token: 'ExpoPushToken[fake-token]',
  platform: 'ios' as const,
  projectId: installation,
};
const binding: DeviceBinding = {
  installationId: installation,
  ownerId: owner,
  secretHash: hash,
  generation: 1,
  token: input.token,
  platform: input.platform,
  projectId: input.projectId,
  revokedAt: null,
  expiresAt: new Date(now.getTime() + 86400000),
  updatedAt: now,
  lastOperationId: installation,
  lastRequestHash: 'b'.repeat(64),
};
describe('installation authority', () => {
  it('creates only at version zero and rejects unknown revocations', () => {
    expect(
      decideDeviceOperation(
        null,
        owner,
        hash,
        'c'.repeat(64),
        { ...input, expectedVersion: 0 },
        'REGISTER',
      ),
    ).toBe('CREATE');
    expect(() =>
      decideDeviceOperation(null, owner, hash, 'c'.repeat(64), input, 'REGISTER'),
    ).toThrow('registration changed');
    expect(() =>
      decideDeviceOperation(
        null,
        owner,
        hash,
        'c'.repeat(64),
        { ...input, expectedVersion: 0 },
        'REVOKE',
      ),
    ).toThrow('registration changed');
  });
  it('requires binding proof as well as the acknowledged version', () => {
    expect(() =>
      decideDeviceOperation(binding, owner, 'd'.repeat(64), 'c'.repeat(64), input, 'REGISTER'),
    ).toThrow('registration changed');
    expect(() =>
      decideDeviceOperation(
        binding,
        owner,
        hash,
        'c'.repeat(64),
        { ...input, expectedVersion: 0 },
        'REGISTER',
      ),
    ).toThrow('registration changed');
    expect(decideDeviceOperation(binding, nextOwner, hash, 'c'.repeat(64), input, 'REGISTER')).toBe(
      'WRITE',
    );
    expect(() =>
      decideDeviceOperation(binding, nextOwner, hash, 'c'.repeat(64), input, 'REVOKE'),
    ).toThrow('registration changed');
  });
  it('replays only the exact operation, payload and current owner', () => {
    const applied = {
      ...binding,
      lastOperationId: operation,
      lastRequestHash: 'c'.repeat(64),
      generation: 2,
    };
    expect(decideDeviceOperation(applied, owner, hash, 'c'.repeat(64), input, 'REGISTER')).toBe(
      'REPLAY',
    );
    expect(() =>
      decideDeviceOperation(applied, owner, hash, 'd'.repeat(64), input, 'REGISTER'),
    ).toThrow('registration changed');
    expect(() =>
      decideDeviceOperation(applied, nextOwner, hash, 'c'.repeat(64), input, 'REGISTER'),
    ).toThrow('registration changed');
  });
  it('cannot let a previous owner overwrite or revoke a newer generation', () => {
    const transferred = { ...binding, ownerId: nextOwner, generation: 3 };
    for (const action of ['REGISTER', 'REVOKE'] as const)
      expect(() =>
        decideDeviceOperation(transferred, owner, hash, 'c'.repeat(64), input, action),
      ).toThrow('registration changed');
  });
});

function fakeDatabase(rows: unknown[][]) {
  const dialect = new PgDialect();
  const queries: ReturnType<PgDialect['sqlToQuery']>[] = [];
  const execute = vi.fn((query: Parameters<PgDialect['sqlToQuery']>[0]) => {
    queries.push(dialect.sqlToQuery(query));
    return Promise.resolve({ rows: rows.shift() ?? [] });
  });
  const tx = { execute };
  const database = {
    transaction: (run: (transaction: typeof tx) => Promise<unknown>) => run(tx),
  } as unknown as ProDateDatabase;
  return { database, queries, execute };
}
describe('device persistence boundary (no live database)', () => {
  it('serializes absent creation, hashes proof and parameterizes tokens', async () => {
    const { database, queries } = fakeDatabase([[], [], [], [], [{ count: 0 }], []]);
    const repository = createNotificationDeviceRepository(database, () => now);
    await expect(
      repository.register(owner, installation, { ...input, expectedVersion: 0 }),
    ).resolves.toEqual({ installationId: installation, version: 1, isRegistered: true });
    const text = queries.map((query) => query.sql).join('\n');
    expect(text).toContain('pg_advisory_xact_lock');
    expect(text).toContain('for update');
    expect(text).not.toContain(input.token);
    expect(queries.flatMap((query) => query.params)).not.toContain(secret);
    expect(queries.flatMap((query) => query.params)).toContain(hash);
    expect(queries.flatMap((query) => query.params)).toContain(input.token);
  });
  it('rejects the sixth active device before persisting', async () => {
    const { database, queries } = fakeDatabase([[], [], [], [], [{ count: 5 }]]);
    await expect(
      createNotificationDeviceRepository(database, () => now).register(owner, installation, {
        ...input,
        expectedVersion: 0,
      }),
    ).rejects.toThrow('Five devices');
    expect(queries.map((query) => query.sql).join('\n')).not.toContain('insert into');
  });
  it('revokes with token removal, new generation and fenced cancellation in one callback', async () => {
    const { database, queries } = fakeDatabase([[], [], [], [binding], [], []]);
    await expect(
      createNotificationDeviceRepository(database, () => now).revoke(owner, installation, input),
    ).resolves.toEqual({ installationId: installation, version: 2, isRegistered: false });
    const text = queries.map((query) => query.sql).join('\n');
    expect(text).toContain('token = null');
    expect(text).toContain("status in ('PENDING', 'LEASED')");
    expect(text).toContain('claim_id = null');
    expect(queries.flatMap((query) => query.params)).not.toContain(secret);
  });
  it('does not renew, cancel or advance a replayed operation', async () => {
    // The request hash is computed by the real repository, captured on initial registration.
    const initial = fakeDatabase([[], [], [], [], [{ count: 0 }], []]);
    const createInput = { ...input, expectedVersion: 0 };
    await createNotificationDeviceRepository(initial.database, () => now).register(
      owner,
      installation,
      createInput,
    );
    const insert = initial.queries.find((query) => query.sql.includes('insert into'))!;
    const requestHash = insert.params.find(
      (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) && value !== hash,
    ) as string;
    const replay = fakeDatabase([
      [],
      [],
      [],
      [{ ...binding, lastOperationId: operation, lastRequestHash: requestHash }],
    ]);
    await expect(
      createNotificationDeviceRepository(replay.database, () => now).register(
        owner,
        installation,
        createInput,
      ),
    ).resolves.toMatchObject({ version: 1 });
    expect(replay.queries.some((query) => query.sql.includes('update notification'))).toBe(false);
  });
});
