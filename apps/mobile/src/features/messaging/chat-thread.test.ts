import type { Conversation, Message } from '@pro-date/contracts';
import { ApiRequestError } from '../../api/http-client';
import type { MessagingApi } from '../../api/messaging';
import type { ChatStorage, OutgoingMessage } from './chat-storage';
import { ChatThread } from './chat-thread';

export const owner = '10000000-0000-4000-8000-000000000001';
export const conversation: Conversation = {
  id: '10000000-0000-4000-8000-000000000002',
  member: { userId: '10000000-0000-4000-8000-000000000003', displayName: 'Avery', photoUrl: null },
  createdAt: '2026-10-08T12:00:00.000Z',
  activityAt: '2026-10-08T12:00:00.000Z',
  lastMessage: null,
};
const clientId = '10000000-0000-4000-8000-000000000004';
const message = (sequence = 1): Message => ({
  id: `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
  clientId,
  conversationId: conversation.id,
  senderId: owner,
  sequence,
  body: 'Hello Avery',
  createdAt: conversation.createdAt,
});
function setup() {
  let messages: Message[] = [];
  let outgoing: OutgoingMessage[] = [];
  const saveConversation = jest.fn();
  const storage: ChatStorage = {
    read: () => Promise.resolve({ conversation, messages: [...messages], outgoing: [...outgoing] }),
    saveConversation,
    saveConversations: jest.fn(),
    cachedConversations: jest.fn().mockResolvedValue([]),
    saveMessages: (_id, rows) => {
      messages = [...messages.filter((m) => !rows.some((r) => r.id === m.id)), ...rows];
      outgoing = outgoing.filter(
        (o) => !rows.some((r) => r.clientId === o.clientId && r.senderId === owner),
      );
      return Promise.resolve();
    },
    enqueue: (row) => {
      outgoing.push(row);
      return Promise.resolve();
    },
    setFailure: (id, failure) => {
      outgoing = outgoing.map((o) => (o.clientId === id ? { ...o, failure } : o));
      return Promise.resolve();
    },
    remove: (id) => {
      outgoing = outgoing.filter((o) => o.clientId !== id);
      return Promise.resolve();
    },
    clear: jest.fn(() => {
      messages = [];
      outgoing = [];
      return Promise.resolve();
    }),
    pendingIds: () => Promise.resolve([conversation.id]),
    close: jest.fn(),
  };
  const api: MessagingApi = {
    conversation: jest.fn().mockResolvedValue(conversation),
    conversations: jest.fn(),
    history: jest.fn().mockResolvedValue({
      data: [],
      olderCursor: null,
      nextAfterSequence: null,
      latestSequence: 0,
    }),
    send: jest.fn().mockResolvedValue(message()),
    unmatch: jest.fn(),
  };
  const make = () =>
    new ChatThread(conversation.id, owner, storage, api, () => clientId, jest.fn());
  return { api, storage, make, saveConversation };
}
describe('durable chat thread', () => {
  it('does not restore a revoked chat from a delayed network response', async () => {
    const { api, saveConversation, make } = setup();
    let resolve!: (value: Conversation) => void;
    jest.mocked(api.conversation).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const thread = make();
    await thread.ready;
    thread.setEnabled(true);
    const sync = thread.sync();
    await Promise.resolve();
    await thread.revoke();
    resolve(conversation);
    await sync;
    expect(saveConversation).not.toHaveBeenCalled();
    expect(thread.getSnapshot()).toMatchObject({ unavailable: true, conversation: null, rows: [] });
    thread.dispose();
  });
  it('does not restore a revoked chat from a delayed cache read', async () => {
    const { storage, make } = setup();
    let resolve!: (value: Awaited<ReturnType<ChatStorage['read']>>) => void;
    storage.read = () =>
      new Promise((done) => {
        resolve = done;
      });
    const thread = make();
    await thread.revoke();
    resolve({ conversation, messages: [message()], outgoing: [] });
    await thread.ready;
    expect(thread.getSnapshot()).toMatchObject({ unavailable: true, conversation: null, rows: [] });
    thread.dispose();
  });
  it('renders immediately, persists before sending, and recovers the same ID after restart', async () => {
    const { api, storage, make } = setup();
    const first = make();
    await first.ready;
    const queued = first.send('Hello Avery');
    expect(first.getSnapshot().rows[0]?.body).toBe('Hello Avery');
    await queued;
    expect(api.send).not.toHaveBeenCalled();
    first.dispose();
    const restarted = make();
    await restarted.ready;
    restarted.setEnabled(true);
    await restarted.flush();
    expect(api.send).toHaveBeenCalledWith(
      conversation.id,
      { clientId, body: 'Hello Avery' },
      expect.any(AbortSignal),
    );
    expect(restarted.getSnapshot().rows).toHaveLength(1);
    expect(restarted.getSnapshot().rows[0]?.status).toBe('sent');
    expect((await storage.read(conversation.id)).outgoing).toHaveLength(0);
    restarted.dispose();
  });
  it('retries an unknown commit outcome without creating another bubble or send ID', async () => {
    const { api, make } = setup();
    const thread = make();
    await thread.ready;
    jest.mocked(api.send).mockRejectedValueOnce(new ApiRequestError('Timeout', 0, 'TIMEOUT', true));
    await thread.send('Hello Avery');
    thread.setEnabled(true);
    await thread.flush();
    expect(thread.getSnapshot().rows[0]?.status).toBe('queued');
    await thread.flush();
    expect(api.send).toHaveBeenCalledTimes(2);
    expect(jest.mocked(api.send).mock.calls.map((call) => call[1].clientId)).toEqual([
      clientId,
      clientId,
    ]);
    expect(thread.getSnapshot().rows).toHaveLength(1);
    thread.dispose();
  });
  it('does not skip incoming messages when a later send acknowledgment arrives first', async () => {
    const { api, make } = setup();
    const thread = make();
    await thread.ready;
    thread.setEnabled(true);
    await thread.sync();
    jest.mocked(api.send).mockResolvedValueOnce(message(3));
    await thread.send('Hello Avery');
    await thread.flush();
    const incoming = {
      ...message(2),
      senderId: conversation.member.userId,
      clientId: conversation.member.userId,
    };
    jest.mocked(api.history).mockResolvedValueOnce({
      data: [incoming, message(3)],
      olderCursor: null,
      nextAfterSequence: null,
      latestSequence: 3,
    });
    await thread.sync();
    expect(api.history).toHaveBeenLastCalledWith(
      conversation.id,
      { afterSequence: 0 },
      expect.any(AbortSignal),
    );
    expect(thread.getSnapshot().rows.map((row) => row.sequence)).toEqual([2, 3]);
    thread.dispose();
  });
  it('clears cached private content when access is revoked and stops queued sends', async () => {
    const { api, storage, make } = setup();
    const thread = make();
    await thread.ready;
    await thread.send('Hello Avery');
    jest
      .mocked(api.conversation)
      .mockRejectedValue(new ApiRequestError('Unavailable', 404, 'NOT_FOUND', false));
    thread.setEnabled(true);
    await thread.sync();
    expect(thread.getSnapshot().unavailable).toBe(true);
    expect(thread.getSnapshot().rows).toEqual([]);
    expect(storage.clear).toHaveBeenCalledWith(conversation.id);
    thread.dispose();
  });
  it('rejects persistence failures instead of discarding the composer draft', async () => {
    const { storage, make } = setup();
    storage.enqueue = jest.fn().mockRejectedValue(new Error('Disk full'));
    const thread = make();
    await thread.ready;
    await expect(thread.send('Hello Avery')).rejects.toThrow('save');
    expect(thread.getSnapshot().rows).toEqual([]);
    thread.dispose();
  });
});
