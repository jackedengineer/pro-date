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
  const saveContexts = jest.fn();
  const storage: ChatStorage = {
    read: () =>
      Promise.resolve({
        conversation,
        messages: [...messages],
        outgoing: [...outgoing],
        contexts: [],
        capabilities: { replies: true, reactions: false },
      }),
    saveCapabilities: jest.fn(),
    saveContexts,
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
    interactionChanges: jest
      .fn()
      .mockResolvedValue({ data: [], nextRevision: 0, latestRevision: 0 }),
    setReaction: jest.fn(),
    capabilities: jest.fn().mockResolvedValue({ replies: true, reactions: false }),
    contexts: jest.fn().mockResolvedValue({ data: [], revision: 0 }),
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
  return { api, storage, make, saveConversation, saveContexts };
}
describe('durable chat thread', () => {
  async function reactionThread(sequence = 1, olderCursor: string | null = null) {
    const test = setup();
    const context = { messageId: message(sequence).id, revision: 5, replyTo: null, reactions: [] };
    jest.mocked(test.api.capabilities).mockResolvedValue({ replies: true, reactions: true });
    jest.mocked(test.api.history).mockResolvedValue({
      data: [message(sequence)],
      olderCursor,
      nextAfterSequence: null,
      latestSequence: sequence,
    });
    jest.mocked(test.api.contexts).mockResolvedValue({ data: [context], revision: 5 });
    jest
      .mocked(test.api.interactionChanges)
      .mockResolvedValue({ data: [], nextRevision: 5, latestRevision: 5 });
    const thread = test.make();
    await thread.ready;
    thread.setEnabled(true);
    await thread.sync();
    // Drain the one coalesced follow-up requested by setEnabled + explicit sync.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return { ...test, thread, context };
  }
  it('keeps reaction ACKs out of the replay cursor and never changes inbox activity', async () => {
    const { api, thread, context } = await reactionThread();
    jest.mocked(api.setReaction).mockResolvedValue({
      ...context,
      revision: 20,
      reactions: [{ userId: owner, reaction: 'HEART', revision: 1 }],
    });
    await thread.setReaction(message().id, 'HEART');
    await thread.syncInteractions();
    expect(api.interactionChanges).toHaveBeenLastCalledWith(
      conversation.id,
      5,
      expect.any(AbortSignal),
    );
    expect(thread.getSnapshot().rows[0]?.context?.revision).toBe(20);
    expect(thread.getSnapshot().conversation?.activityAt).toBe(conversation.activityAt);
    thread.dispose();
  });
  it('repairs changes to older loaded rows without advancing the cursor from an older-page snapshot', async () => {
    const { api, thread, context } = await reactionThread(2, 'older');
    jest.mocked(api.history).mockResolvedValue({
      data: [message(1)],
      olderCursor: null,
      nextAfterSequence: null,
      latestSequence: 2,
    });
    const older = { ...context, messageId: message(1).id, revision: 100 };
    jest.mocked(api.contexts).mockResolvedValue({ data: [older], revision: 100 });
    await thread.loadOlder();
    jest.mocked(api.interactionChanges).mockResolvedValue({
      data: [
        {
          ...older,
          revision: 101,
          reactions: [{ userId: owner, reaction: 'FIRE', revision: 1 }],
        },
      ],
      nextRevision: 101,
      latestRevision: 101,
    });
    const untouched = thread.getSnapshot().rows.find((row) => row.messageId === message(2).id);
    await thread.syncInteractions();
    expect(api.interactionChanges).toHaveBeenLastCalledWith(
      conversation.id,
      5,
      expect.any(AbortSignal),
    );
    expect(
      thread.getSnapshot().rows.find((row) => row.messageId === message(1).id)?.context
        ?.reactions[0]?.reaction,
    ).toBe('FIRE');
    expect(thread.getSnapshot().rows.find((row) => row.messageId === message(2).id)).toBe(
      untouched,
    );
    thread.dispose();
  });
  it('serializes changes per message and discards a late ACK after revocation', async () => {
    const { api, thread, context } = await reactionThread();
    let finish!: (context: Awaited<ReturnType<MessagingApi['setReaction']>>) => void;
    jest.mocked(api.setReaction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const write = thread.setReaction(message().id, 'HEART');
    await thread.setReaction(message().id, 'FIRE');
    expect(api.setReaction).toHaveBeenCalledTimes(1);
    expect(thread.getSnapshot().rows[0]?.reactionPending).toBe(true);
    expect(thread.getSnapshot().rows[0]?.pendingReaction).toBe('HEART');
    // Optimism is presentation-only: server context and disk never contain an invented revision.
    expect(thread.getSnapshot().rows[0]?.context?.reactions).toEqual([]);
    await thread.revoke();
    finish({
      ...context,
      revision: 6,
      reactions: [{ userId: owner, reaction: 'HEART', revision: 1 }],
    });
    await write;
    expect(thread.getSnapshot()).toMatchObject({ unavailable: true, rows: [] });
    thread.dispose();
  });
  it('shows replacements and removals before the network responds, then rolls back on failure', async () => {
    const { api, saveContexts, thread, context } = await reactionThread();
    jest.mocked(api.setReaction).mockResolvedValue({
      ...context,
      revision: 6,
      reactions: [{ userId: owner, reaction: 'HEART', revision: 1 }],
    });
    await thread.setReaction(message().id, 'HEART');
    saveContexts.mockClear();
    let fail!: (error: Error) => void;
    jest.mocked(api.setReaction).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const replacement = thread.setReaction(message().id, 'FIRE');
    expect(thread.getSnapshot().rows[0]?.pendingReaction).toBe('FIRE');
    expect(saveContexts).not.toHaveBeenCalled();
    fail(new Error('Connection lost'));
    await replacement;
    expect(thread.getSnapshot().rows[0]?.pendingReaction).toBeUndefined();
    expect(thread.getSnapshot().rows[0]?.context?.reactions[0]?.reaction).toBe('HEART');
    expect(thread.getSnapshot().rows[0]?.reactionError).toContain('Refresh');
    jest.mocked(api.contexts).mockResolvedValue({
      data: [
        { ...context, revision: 6, reactions: [{ userId: owner, reaction: 'HEART', revision: 1 }] },
      ],
      revision: 6,
    });
    await thread.refreshReaction(message().id);
    const removal = thread.setReaction(message().id, 'HEART');
    expect(thread.getSnapshot().rows[0]?.pendingReaction).toBeNull();
    fail(new Error('Connection lost'));
    await removal;
    expect(thread.getSnapshot().rows[0]?.pendingReaction).toBeUndefined();
    expect(thread.getSnapshot().rows[0]?.context?.reactions[0]?.reaction).toBe('HEART');
    thread.dispose();
  });
  it('requires authoritative refresh after an unknown reaction outcome, never queues offline writes', async () => {
    const { api, thread, context } = await reactionThread();
    jest
      .mocked(api.setReaction)
      .mockRejectedValue(new ApiRequestError('Timeout', 0, 'TIMEOUT', true));
    await thread.setReaction(message().id, 'HEART');
    expect(thread.getSnapshot().rows[0]?.reactionError).toContain('Refresh');
    await thread.setReaction(message().id, 'FIRE');
    expect(api.setReaction).toHaveBeenCalledTimes(1);
    jest.mocked(api.contexts).mockResolvedValue({
      data: [
        {
          ...context,
          revision: 6,
          reactions: [{ userId: owner, reaction: 'HEART', revision: 1 }],
        },
      ],
      revision: 6,
    });
    await thread.refreshReaction(message().id);
    jest.mocked(api.setReaction).mockResolvedValue({
      ...context,
      revision: 7,
      reactions: [{ userId: owner, reaction: null, revision: 2 }],
    });
    await thread.setReaction(message().id, 'HEART');
    expect(api.setReaction).toHaveBeenLastCalledWith(
      conversation.id,
      message().id,
      { reaction: null, expectedRevision: 1 },
      expect.any(AbortSignal),
    );
    thread.setEnabled(false);
    await thread.setReaction(message().id, 'FIRE');
    expect(api.setReaction).toHaveBeenCalledTimes(2);
    thread.dispose();
  });
  it('keeps newer server context when an older ACK follows an optimistic choice', async () => {
    const { api, thread, context } = await reactionThread();
    let finish!: (value: Awaited<ReturnType<MessagingApi['setReaction']>>) => void;
    jest.mocked(api.setReaction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const write = thread.setReaction(message().id, 'HEART');
    jest.mocked(api.interactionChanges).mockResolvedValue({
      data: [
        {
          ...context,
          revision: 8,
          reactions: [
            { userId: owner, reaction: 'LIKE', revision: 2 },
            { userId: conversation.member.userId, reaction: 'FIRE', revision: 1 },
          ],
        },
      ],
      nextRevision: 8,
      latestRevision: 8,
    });
    await thread.syncInteractions();
    expect(thread.getSnapshot().rows[0]?.pendingReaction).toBe('HEART');
    finish({
      ...context,
      revision: 6,
      reactions: [{ userId: owner, reaction: 'HEART', revision: 1 }],
    });
    await write;
    const saved = thread.getSnapshot().rows[0];
    expect(saved?.pendingReaction).toBeUndefined();
    expect(saved?.context?.revision).toBe(8);
    expect(saved?.context?.reactions.map((state) => state.reaction)).toEqual(['LIKE', 'FIRE']);
    thread.dispose();
  });
  it('keeps a reply target and send ID through offline restart', async () => {
    const { api, storage, make } = setup();
    await storage.saveMessages(conversation.id, [message(2)]);
    const thread = make();
    await thread.ready;
    thread.selectReply(message(2).id);
    await thread.send('A thoughtful reply');
    expect((await storage.read(conversation.id)).outgoing[0]?.replyTo?.messageId).toBe(
      message(2).id,
    );
    expect(thread.getSnapshot().replyTo).toBeNull();
    thread.dispose();
    const restarted = make();
    await restarted.ready;
    restarted.setEnabled(true);
    await restarted.flush();
    expect(api.send).toHaveBeenCalledWith(
      conversation.id,
      { clientId, body: 'A thoughtful reply', replyToMessageId: message(2).id },
      expect.any(AbortSignal),
    );
    restarted.dispose();
  });
  it('preserves reply selection if saving the outgoing intent fails', async () => {
    const { storage, make } = setup();
    await storage.saveMessages(conversation.id, [message()]);
    storage.enqueue = jest.fn().mockRejectedValue(new Error('disk full'));
    const thread = make();
    await thread.ready;
    thread.selectReply(message().id);
    await expect(thread.send('hello')).rejects.toThrow('draft');
    expect(thread.getSnapshot().replyTo?.messageId).toBe(message().id);
    thread.dispose();
  });
  it('does not clear a newer reply selection when an earlier save finishes', async () => {
    const { storage, make } = setup();
    await storage.saveMessages(conversation.id, [message(1), message(2)]);
    let finish!: () => void;
    storage.enqueue = jest.fn(
      () =>
        new Promise<void>((done) => {
          finish = done;
        }),
    );
    const thread = make();
    await thread.ready;
    thread.selectReply(message(1).id);
    const send = thread.send('first reply');
    thread.selectReply(message(2).id);
    finish();
    await send;
    expect(thread.getSnapshot().replyTo?.messageId).toBe(message(2).id);
    thread.dispose();
  });
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
    resolve({
      conversation,
      messages: [message()],
      outgoing: [],
      contexts: [],
      capabilities: null,
    });
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
