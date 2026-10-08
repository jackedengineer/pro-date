/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Message } from '@pro-date/contracts';
import * as SQLite from 'expo-sqlite';
import { cachedChatOwner, forgetChatAccounts, openChatStorage } from './sqlite-chat-storage';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
const owner = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const clientId = '10000000-0000-4000-8000-000000000003';
const pending = {
  conversationId: id,
  clientId,
  body: 'An offline hello.',
  createdAt: '2026-10-08T00:00:00.000Z',
  failure: null,
};
const message: Message = {
  conversationId: id,
  clientId,
  body: pending.body,
  createdAt: pending.createdAt,
  id: owner,
  senderId: owner,
  sequence: 1,
};
describe('chat storage SQL against a real SQLite engine', () => {
  let database: DatabaseSync;
  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    // Only the asynchronous Expo/native bridge is replaced; SQL and transactions execute for real.
    const bridge = {
      execAsync: (sql: string) => {
        database.exec(sql);
        return Promise.resolve();
      },
      runAsync: (sql: string, ...values: SQLInputValue[]) =>
        Promise.resolve(database.prepare(sql).run(...values)),
      getFirstAsync: (sql: string, ...values: SQLInputValue[]) =>
        Promise.resolve(database.prepare(sql).get(...values) ?? null),
      getAllAsync: (sql: string, ...values: SQLInputValue[]) =>
        Promise.resolve(database.prepare(sql).all(...values)),
      withExclusiveTransactionAsync: async (task: (tx: SQLite.SQLiteDatabase) => Promise<void>) => {
        database.exec('BEGIN IMMEDIATE');
        try {
          await task(bridge as unknown as SQLite.SQLiteDatabase);
          database.exec('COMMIT');
        } catch (failure: unknown) {
          database.exec('ROLLBACK');
          throw failure;
        }
      },
      closeAsync: () => Promise.resolve(),
    };
    jest
      .mocked(SQLite.openDatabaseAsync)
      .mockResolvedValue(bridge as unknown as SQLite.SQLiteDatabase);
  });
  afterEach(() => database.close());
  it('hydrates only the signed-in account mapping and recent cached inbox', async () => {
    const storage = await openChatStorage(owner, 'clerk-test-owner');
    const summary = {
      id,
      member: { userId: clientId, displayName: 'Avery', photoUrl: null },
      createdAt: pending.createdAt,
      activityAt: pending.createdAt,
      lastMessage: null,
    };
    await storage.saveConversations([summary]);
    expect(await storage.cachedConversations()).toEqual([summary]);
    await storage.close(false);
    expect(await cachedChatOwner('clerk-test-owner')).toBe(owner);
    expect(await cachedChatOwner('clerk-other')).toBeNull();
    await forgetChatAccounts();
    expect(await cachedChatOwner('clerk-test-owner')).toBeNull();
  });
  it('persists outgoing intent across reopening and atomically replaces it with a confirmed message', async () => {
    const first = await openChatStorage(owner);
    await first.enqueue(pending);
    await first.close(false);
    const second = await openChatStorage(owner);
    expect((await second.read(id)).outgoing).toEqual([pending]);
    await second.saveMessages(id, [message]);
    await second.saveMessages(id, [message]);
    expect(await second.read(id)).toMatchObject({ outgoing: [], messages: [message] });
    await second.close(false);
  });
  it('purges incompatible accounts, guards closed sessions, and clears history on logout', async () => {
    const first = await openChatStorage(owner);
    await first.enqueue(pending);
    await first.saveMessages(id, [message]);
    await first.close(false);
    await expect(first.enqueue(pending)).rejects.toThrow('closed');
    const other = await openChatStorage(clientId);
    expect((await other.read(id)).messages).toEqual([]);
    expect(database.prepare('SELECT count(*) AS count FROM chat_messages').get()?.count).toBe(0);
    await other.enqueue(pending);
    await other.close(true);
    expect(database.prepare('SELECT count(*) AS count FROM chat_outgoing').get()?.count).toBe(0);
  });
  it('bounds the persisted cache without truncating pending sends', async () => {
    const storage = await openChatStorage(owner);
    await storage.enqueue(pending);
    const rows = Array.from({ length: 250 }, (_, index) => ({
      ...message,
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      clientId: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sequence: index + 1,
    }));
    await storage.saveMessages(id, rows);
    expect((await storage.read(id)).messages).toHaveLength(200);
    expect((await storage.read(id)).outgoing).toEqual([pending]);
    await storage.close(true);
  });
});
