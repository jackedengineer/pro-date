import { conversationSchema, messageSchema, type Message } from '@pro-date/contracts';
import * as SQLite from 'expo-sqlite';
import { z } from 'zod';
import type { ChatStorage, OutgoingMessage } from './chat-storage';

const outgoingSchema = z.object({
  conversationId: z.uuid(),
  clientId: z.uuid(),
  body: z.string().min(1).max(2000),
  createdAt: z.iso.datetime({ offset: true }),
  failure: z.string().nullable(),
});
const schema = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS chat_conversations (owner TEXT NOT NULL, id TEXT NOT NULL, summary TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(owner, id));
CREATE TABLE IF NOT EXISTS chat_messages (owner TEXT NOT NULL, conversation_id TEXT NOT NULL, id TEXT NOT NULL, sender_id TEXT NOT NULL, client_id TEXT NOT NULL, sequence INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(owner, id), UNIQUE(owner, conversation_id, sequence));
CREATE INDEX IF NOT EXISTS chat_history ON chat_messages(owner, conversation_id, sequence);
CREATE TABLE IF NOT EXISTS chat_outgoing (owner TEXT NOT NULL, conversation_id TEXT NOT NULL, client_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, failure TEXT, PRIMARY KEY(owner, client_id));
CREATE TABLE IF NOT EXISTS chat_account (subject TEXT PRIMARY KEY, owner TEXT NOT NULL);
`;
export async function cachedChatOwner(subject: string): Promise<string | null> {
  const db = await SQLite.openDatabaseAsync('prodate-messaging.db');
  try {
    await db.execAsync(schema);
    const row = await db.getFirstAsync<{ owner: string }>(
      'SELECT owner FROM chat_account WHERE subject = ?',
      subject,
    );
    return row === null ? null : z.uuid().parse(row.owner);
  } finally {
    await db.closeAsync();
  }
}
export async function forgetChatAccounts() {
  const db = await SQLite.openDatabaseAsync('prodate-messaging.db');
  try {
    await db.execAsync(schema);
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const table of ['chat_messages', 'chat_outgoing', 'chat_conversations', 'chat_account'])
        await tx.runAsync(`DELETE FROM ${table}`);
    });
  } finally {
    await db.closeAsync();
  }
}
export async function openChatStorage(owner: string, subject?: string): Promise<ChatStorage> {
  const db = await SQLite.openDatabaseAsync('prodate-messaging.db');
  await db.execAsync(schema);
  let closed = false;
  let closing: Promise<void> | null = null;
  let writes: Promise<void> = Promise.resolve();
  const write = (operation: (tx: SQLite.SQLiteDatabase) => Promise<void>) => {
    if (closed) return Promise.reject(new Error('Chat session closed.'));
    const job = writes.then(async () => {
      if (closed) throw new Error('Chat session closed.');
      await db.withExclusiveTransactionAsync(operation);
    });
    writes = job.catch(() => {});
    return job;
  };
  await write(async (tx) => {
    for (const table of ['chat_outgoing', 'chat_messages', 'chat_conversations', 'chat_account']) {
      await tx.runAsync(`DELETE FROM ${table} WHERE owner <> ?`, owner);
    }
    if (subject !== undefined)
      await tx.runAsync(
        'INSERT OR REPLACE INTO chat_account(subject,owner) VALUES (?,?)',
        subject,
        owner,
      );
    // History is only a bounded convenience cache; queued sends are not expired silently.
    await tx.runAsync(
      'DELETE FROM chat_messages WHERE owner = ? AND conversation_id IN (SELECT id FROM chat_conversations WHERE owner = ? AND updated_at < ?)',
      owner,
      owner,
      Date.now() - 7 * 86_400_000,
    );
  });
  const clear = async (tx: SQLite.SQLiteDatabase, id: string) => {
    await tx.runAsync(
      'DELETE FROM chat_messages WHERE owner = ? AND conversation_id = ?',
      owner,
      id,
    );
    await tx.runAsync(
      'DELETE FROM chat_outgoing WHERE owner = ? AND conversation_id = ?',
      owner,
      id,
    );
    await tx.runAsync('DELETE FROM chat_conversations WHERE owner = ? AND id = ?', owner, id);
  };
  return {
    async read(id) {
      await writes;
      if (closed) throw new Error('Chat session closed.');
      const summary = await db.getFirstAsync<{ summary: string }>(
        'SELECT summary FROM chat_conversations WHERE owner = ? AND id = ?',
        owner,
        id,
      );
      const rows = await db.getAllAsync<Message>(
        'SELECT id, conversation_id AS conversationId, sender_id AS senderId, client_id AS clientId, sequence, body, created_at AS createdAt FROM chat_messages WHERE owner = ? AND conversation_id = ? ORDER BY sequence',
        owner,
        id,
      );
      const pending = await db.getAllAsync<OutgoingMessage>(
        'SELECT conversation_id AS conversationId, client_id AS clientId, body, created_at AS createdAt, failure FROM chat_outgoing WHERE owner = ? AND conversation_id = ? ORDER BY created_at, rowid',
        owner,
        id,
      );
      return {
        conversation:
          summary === null ? null : conversationSchema.parse(JSON.parse(summary.summary)),
        messages: rows.map((row) => messageSchema.parse(row)),
        outgoing: pending.map((row) => outgoingSchema.parse(row)),
      };
    },
    saveConversation: (conversation) =>
      write(async (tx) => {
        await tx.runAsync(
          'INSERT OR REPLACE INTO chat_conversations(owner,id,summary,updated_at) VALUES (?,?,?,?)',
          owner,
          conversation.id,
          JSON.stringify(conversation),
          Date.now(),
        );
      }),
    saveConversations: (conversations) =>
      write(async (tx) => {
        for (const conversation of conversations)
          await tx.runAsync(
            'INSERT OR REPLACE INTO chat_conversations(owner,id,summary,updated_at) VALUES (?,?,?,?)',
            owner,
            conversation.id,
            JSON.stringify(conversation),
            Date.now(),
          );
      }),
    async cachedConversations() {
      await writes;
      if (closed) return [];
      const rows = await db.getAllAsync<{ summary: string }>(
        'SELECT summary FROM chat_conversations WHERE owner = ? AND updated_at >= ? ORDER BY updated_at DESC LIMIT 20',
        owner,
        Date.now() - 7 * 86_400_000,
      );
      return rows
        .map((row) => conversationSchema.parse(JSON.parse(row.summary)))
        .sort((a, b) => b.activityAt.localeCompare(a.activityAt));
    },
    saveMessages: (id, messages) =>
      write(async (tx) => {
        for (const message of messages) {
          if (message.conversationId !== id) throw new Error('Wrong conversation.');
          await tx.runAsync(
            'INSERT OR REPLACE INTO chat_messages(owner,conversation_id,id,sender_id,client_id,sequence,body,created_at) VALUES (?,?,?,?,?,?,?,?)',
            owner,
            id,
            message.id,
            message.senderId,
            message.clientId,
            message.sequence,
            message.body,
            message.createdAt,
          );
          if (message.senderId === owner)
            await tx.runAsync(
              'DELETE FROM chat_outgoing WHERE owner = ? AND client_id = ?',
              owner,
              message.clientId,
            );
        }
        await tx.runAsync(
          'DELETE FROM chat_messages WHERE owner = ? AND conversation_id = ? AND id NOT IN (SELECT id FROM chat_messages WHERE owner = ? AND conversation_id = ? ORDER BY sequence DESC LIMIT 200)',
          owner,
          id,
          owner,
          id,
        );
      }),
    enqueue: (message) =>
      write(async (tx) => {
        const count = await tx.getFirstAsync<{ count: number }>(
          'SELECT count(*) AS count FROM chat_outgoing WHERE owner = ?',
          owner,
        );
        if ((count?.count ?? 0) >= 500)
          throw new Error('Pending queue is full. Connect before sending more.');
        await tx.runAsync(
          'INSERT INTO chat_outgoing(owner,conversation_id,client_id,body,created_at,failure) VALUES (?,?,?,?,?,?)',
          owner,
          message.conversationId,
          message.clientId,
          message.body,
          message.createdAt,
          message.failure,
        );
      }),
    setFailure: (id, failure) =>
      write(async (tx) => {
        await tx.runAsync(
          'UPDATE chat_outgoing SET failure = ? WHERE owner = ? AND client_id = ?',
          failure,
          owner,
          id,
        );
      }),
    remove: (id) =>
      write(async (tx) => {
        await tx.runAsync('DELETE FROM chat_outgoing WHERE owner = ? AND client_id = ?', owner, id);
      }),
    clear: (id) => write((tx) => clear(tx, id)),
    async pendingIds() {
      await writes;
      if (closed) return [];
      const rows = await db.getAllAsync<{ id: string }>(
        'SELECT DISTINCT conversation_id AS id FROM chat_outgoing WHERE owner = ?',
        owner,
      );
      return rows.map((row) => row.id);
    },
    close(purge) {
      if (closing !== null) return closing;
      closed = true;
      closing = (async () => {
        await writes;
        try {
          if (purge)
            await db.withExclusiveTransactionAsync(async (tx) => {
              for (const table of [
                'chat_messages',
                'chat_outgoing',
                'chat_conversations',
                'chat_account',
              ])
                await tx.runAsync(`DELETE FROM ${table} WHERE owner = ?`, owner);
            });
        } finally {
          await db.closeAsync();
        }
      })();
      return closing;
    },
  };
}
