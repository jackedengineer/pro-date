import {
  messageBodySchema,
  type ChatCapabilities,
  type Conversation,
  type Message,
  type MessageContext,
  type MessageQuote,
  type ReactionKind,
} from '@pro-date/contracts';
import { ApiRequestError } from '../../api/http-client';
import type { MessagingApi } from '../../api/messaging';
import type { ChatStorage, OutgoingMessage } from './chat-storage';

export type ChatRow = Omit<Message, 'id' | 'sequence'> & {
  key: string;
  sequence: number | null;
  status: 'saving' | 'queued' | 'sending' | 'sent' | 'failed';
  failure: string | null;
  messageId: string | null;
  context: MessageContext | null;
  replyTo: MessageQuote | null;
  reactionPending: boolean;
  reactionError: string | null;
};
export interface ThreadSnapshot {
  conversation: Conversation | null;
  rows: ChatRow[];
  loading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  error: string | null;
  unavailable: boolean;
  online: boolean;
  capabilities: ChatCapabilities;
  replyTo: MessageQuote | null;
  contextError: string | null;
}
export class ChatThread {
  private messages: Message[] = [];
  private outgoing: OutgoingMessage[] = [];
  private contexts = new Map<string, MessageContext>();
  private reactionPending = new Set<string>();
  private reactionErrors = new Map<string, string>();
  private interactionCursor: number | null = null;
  private interactionSync: Promise<void> | null = null;
  private interactionsDirty = false;
  private statuses = new Map<string, ChatRow['status']>();
  private listeners = new Set<() => void>();
  private snapshot: ThreadSnapshot = {
    conversation: null,
    rows: [],
    loading: true,
    loadingOlder: false,
    hasOlder: false,
    error: null,
    unavailable: false,
    online: false,
    capabilities: { replies: false, reactions: false },
    replyTo: null,
    contextError: null,
  };
  private enabled = false;
  private disposed = false;
  private watermark: number | null = null;
  private olderCursor: string | null = null;
  private syncing: Promise<void> | null = null;
  private sending: Promise<void> | null = null;
  private syncAgain = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private controllers = new Set<AbortController>();
  readonly ready: Promise<void>;
  constructor(
    readonly id: string,
    readonly ownerId: string,
    private storage: ChatStorage,
    private api: MessagingApi,
    private uuid: () => string,
    private changed: () => void,
  ) {
    this.ready = storage
      .read(id)
      .then((cached) => {
        if (this.disposed || this.snapshot.unavailable) return;
        this.messages = cached.messages;
        this.outgoing = cached.outgoing;
        this.contexts = new Map(cached.contexts.map((context) => [context.messageId, context]));
        this.publish({
          conversation: cached.conversation,
          loading: false,
          capabilities: cached.capabilities ?? { replies: false, reactions: false },
        });
      })
      .catch(() => {
        if (this.snapshot.unavailable) return;
        this.publish({
          loading: false,
          error: 'We couldn’t open the local chat cache. Please reopen messaging.',
        });
      });
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<ThreadSnapshot> = {}) {
    if (this.disposed) return;
    const confirmed = new Set(this.messages.map((m) => `${m.senderId}:${m.clientId}`));
    const rows: ChatRow[] = this.messages.map((m) => ({
      ...m,
      key: `${m.senderId}:${m.clientId}`,
      status: 'sent',
      failure: null,
      messageId: m.id,
      context: this.contexts.get(m.id) ?? null,
      replyTo: this.contexts.get(m.id)?.replyTo ?? null,
      reactionPending: this.reactionPending.has(m.id),
      reactionError: this.reactionErrors.get(m.id) ?? null,
    }));
    for (const pending of this.outgoing)
      if (!confirmed.has(`${this.ownerId}:${pending.clientId}`))
        rows.push({
          ...pending,
          senderId: this.ownerId,
          key: `${this.ownerId}:${pending.clientId}`,
          sequence: null,
          messageId: null,
          context: null,
          replyTo: pending.replyTo ?? null,
          reactionPending: false,
          reactionError: null,
          status:
            this.statuses.get(pending.clientId) ?? (pending.failure === null ? 'queued' : 'failed'),
        });
    const previous = new Map(this.snapshot.rows.map((row) => [row.key, row]));
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      rows: rows.map((row) => {
        const old = previous.get(row.key);
        return old !== undefined &&
          old.sequence === row.sequence &&
          old.status === row.status &&
          old.failure === row.failure &&
          old.context === row.context &&
          old.replyTo === row.replyTo &&
          old.reactionPending === row.reactionPending &&
          old.reactionError === row.reactionError &&
          old.body === row.body
          ? old
          : row;
      }),
    };
    for (const listener of this.listeners) listener();
  }
  private async accept(messages: Message[]) {
    if (this.disposed || this.snapshot.unavailable) return;
    if (messages.length === 0) {
      this.publish({ error: null });
      return;
    }
    await this.storage.saveMessages(this.id, messages);
    if (this.disposed || this.snapshot.unavailable) return;
    const byId = new Map(this.messages.map((m) => [m.id, m]));
    for (const message of messages) byId.set(message.id, byId.get(message.id) ?? message);
    this.messages = [...byId.values()].sort((a, b) => a.sequence - b.sequence);
    const localContexts: MessageContext[] = [];
    for (const message of messages) {
      const pending = this.outgoing.find(
        (row) => row.clientId === message.clientId && message.senderId === this.ownerId,
      );
      if (pending?.replyTo !== undefined && !this.contexts.has(message.id)) {
        const context = {
          messageId: message.id,
          revision: 0,
          replyTo: pending.replyTo,
          reactions: [],
        };
        this.contexts.set(message.id, context);
        localContexts.push(context);
      }
    }
    if (localContexts.length > 0) await this.storage.saveContexts(this.id, localContexts);
    if (this.disposed || this.snapshot.unavailable) return;
    this.outgoing = this.outgoing.filter(
      (o) => !messages.some((m) => m.clientId === o.clientId && m.senderId === this.ownerId),
    );
    this.publish({ error: null });
    this.changed();
  }
  setEnabled(enabled: boolean) {
    if (this.disposed || this.snapshot.unavailable) return;
    this.enabled = enabled;
    this.publish({ online: enabled });
    if (!enabled) {
      clearTimeout(this.retryTimer);
      for (const request of this.controllers) request.abort();
    } else {
      void this.sync();
      void this.flush();
    }
  }
  selectReply(messageId: string | null) {
    if (messageId === null) {
      this.publish({ replyTo: null });
      return;
    }
    if (!this.snapshot.capabilities.replies || this.snapshot.unavailable || this.disposed) return;
    const message = this.messages.find((row) => row.id === messageId);
    if (message === undefined) return;
    this.publish({
      replyTo: {
        messageId,
        senderId: message.senderId,
        excerpt: Array.from(message.body).slice(0, 120).join(''),
      },
    });
  }
  async send(body: string) {
    const parsed = messageBodySchema.parse(body);
    if (this.snapshot.loading) await this.ready;
    if (this.disposed || this.snapshot.unavailable)
      throw new Error('This conversation is no longer available.');
    const pending: OutgoingMessage = {
      conversationId: this.id,
      clientId: this.uuid(),
      body: parsed,
      createdAt: new Date().toISOString(),
      failure: null,
      ...(this.snapshot.replyTo === null ? {} : { replyTo: this.snapshot.replyTo }),
    };
    this.outgoing.push(pending);
    this.statuses.set(pending.clientId, 'saving');
    this.publish();
    try {
      await this.storage.enqueue(pending);
    } catch {
      this.outgoing = this.outgoing.filter((o) => o.clientId !== pending.clientId);
      this.statuses.delete(pending.clientId);
      this.publish();
      throw new Error(
        'We couldn’t save this message on your device. Your draft hasn’t been cleared.',
      );
    }
    this.statuses.delete(pending.clientId);
    this.publish(this.snapshot.replyTo === pending.replyTo ? { replyTo: null } : {});
    void this.flush();
  }
  async retry(clientId: string) {
    await this.storage.setFailure(clientId, null);
    this.outgoing = this.outgoing.map((o) =>
      o.clientId === clientId ? { ...o, failure: null } : o,
    );
    this.statuses.delete(clientId);
    this.publish();
    await this.flush();
  }
  async remove(clientId: string) {
    await this.storage.remove(clientId);
    this.outgoing = this.outgoing.filter((o) => o.clientId !== clientId);
    this.statuses.delete(clientId);
    this.publish();
  }
  flush(): Promise<void> {
    if (!this.enabled || this.disposed || this.snapshot.unavailable) return Promise.resolve();
    if (this.sending !== null) return this.sending;
    this.sending = this.flushQueue().finally(() => {
      this.sending = null;
    });
    return this.sending;
  }
  private async flushQueue() {
    await this.ready;
    while (this.enabled && !this.disposed && !this.snapshot.unavailable) {
      const pending = this.outgoing.find(
        (o) => o.failure === null && this.statuses.get(o.clientId) !== 'saving',
      );
      if (pending === undefined) return;
      const request = new AbortController();
      this.controllers.add(request);
      this.statuses.set(pending.clientId, 'sending');
      this.publish();
      try {
        const message = await this.api.send(
          this.id,
          {
            clientId: pending.clientId,
            body: pending.body,
            ...(pending.replyTo === undefined
              ? {}
              : { replyToMessageId: pending.replyTo.messageId }),
          },
          request.signal,
        );
        // An ACK may leap over an incoming message: only REST history advances the sync watermark.
        await this.accept([message]);
        await this.refreshContexts([message.id], request.signal);
        this.statuses.delete(pending.clientId);
        this.attempts = 0;
      } catch (failure: unknown) {
        this.statuses.delete(pending.clientId);
        if (this.disposed || this.snapshot.unavailable) return;
        if (failure instanceof ApiRequestError && failure.status === 404) {
          await this.revoke();
          return;
        }
        const retryable = !(failure instanceof ApiRequestError) || failure.retryable;
        if (!retryable) {
          const reason =
            failure instanceof Error ? failure.message : 'Message not sent. Try again.';
          try {
            await this.storage.setFailure(pending.clientId, reason);
          } catch {
            /* Keep the durable intent for the next session. */
          }
          this.outgoing = this.outgoing.map((o) =>
            o.clientId === pending.clientId ? { ...o, failure: reason } : o,
          );
        } else if (this.enabled) {
          clearTimeout(this.retryTimer);
          this.retryTimer = setTimeout(
            () => void this.flush(),
            Math.min(30_000, 1000 * 2 ** this.attempts++),
          );
        }
        this.publish();
        if (retryable) return;
      } finally {
        this.controllers.delete(request);
      }
    }
  }
  sync(): Promise<void> {
    if (!this.enabled || this.disposed || this.snapshot.unavailable) return Promise.resolve();
    if (this.syncing !== null) {
      this.syncAgain = true;
      return this.syncing;
    }
    this.syncing = this.synchronize().finally(() => {
      this.syncing = null;
      if (this.syncAgain) {
        this.syncAgain = false;
        if (this.enabled) void this.sync();
      }
    });
    return this.syncing;
  }
  private async synchronize() {
    await this.ready;
    if (!this.enabled || this.disposed || this.snapshot.unavailable) return;
    const request = new AbortController();
    this.controllers.add(request);
    try {
      const conversation = await this.api.conversation(this.id, request.signal);
      if (this.disposed || this.snapshot.unavailable || request.signal.aborted) return;
      await this.storage.saveConversation(conversation);
      if (this.disposed || this.snapshot.unavailable || request.signal.aborted) return;
      this.publish({ conversation });
      try {
        const capabilities = await this.api.capabilities(this.id, request.signal);
        if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
        await this.storage.saveCapabilities(this.id, capabilities);
        if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
        this.publish({ capabilities, ...(capabilities.replies ? {} : { replyTo: null }) });
      } catch {
        if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
        this.publish({ capabilities: { replies: false, reactions: false }, replyTo: null });
      }
      do {
        const baseline = this.watermark === null;
        const page = await this.api.history(
          this.id,
          baseline ? {} : { afterSequence: this.watermark! },
          request.signal,
        );
        if (this.disposed || this.snapshot.unavailable || request.signal.aborted) return;
        // A fresh latest page resets a truncated cached window so its older cursor cannot skip gaps.
        if (baseline)
          this.messages = this.messages.filter((message) => message.sequence > page.latestSequence);
        await this.accept(page.data);
        if (this.disposed || this.snapshot.unavailable || request.signal.aborted) return;
        this.watermark = page.nextAfterSequence ?? page.latestSequence;
        await this.refreshContexts(
          page.data.map((message) => message.id),
          request.signal,
        );
        if (this.disposed || this.snapshot.unavailable || request.signal.aborted) return;
        if (baseline) {
          this.olderCursor = page.olderCursor;
          this.publish({ hasOlder: this.olderCursor !== null });
        }
        if (page.nextAfterSequence === null) break;
      } while (this.enabled && !this.disposed);
      await this.syncInteractions();
    } catch (failure: unknown) {
      if (this.disposed || this.snapshot.unavailable) return;
      if (failure instanceof ApiRequestError && failure.status === 404) await this.revoke();
      else if (!request.signal.aborted)
        this.publish({
          error:
            failure instanceof Error ? failure.message : 'We couldn’t refresh this conversation.',
        });
    } finally {
      this.controllers.delete(request);
    }
  }
  private async mergeContexts(data: MessageContext[], signal: AbortSignal) {
    if (signal.aborted || this.disposed || this.snapshot.unavailable) return;
    const loaded = new Set(this.messages.map((message) => message.id));
    const changed = data.filter((context) => {
      const current = this.contexts.get(context.messageId);
      return (
        loaded.has(context.messageId) &&
        (current === undefined ||
          (current.revision <= context.revision &&
            JSON.stringify(current) !== JSON.stringify(context)))
      );
    });
    if (changed.length === 0) return;
    await this.storage.saveContexts(this.id, changed);
    if (signal.aborted || this.disposed || this.snapshot.unavailable) return;
    for (const context of changed) {
      const current = this.contexts.get(context.messageId);
      if (current === undefined || current.revision <= context.revision)
        this.contexts.set(context.messageId, context);
    }
    this.publish();
  }
  private async refreshContexts(ids: string[], signal: AbortSignal): Promise<boolean> {
    if (
      ids.length === 0 ||
      (!this.snapshot.capabilities.replies && !this.snapshot.capabilities.reactions)
    )
      return false;
    try {
      const page = await this.api.contexts(this.id, ids, signal);
      if (signal.aborted || this.disposed || this.snapshot.unavailable) return false;
      await this.mergeContexts(page.data, signal);
      if (signal.aborted || this.disposed || this.snapshot.unavailable) return false;
      this.publish({ contextError: null });
      return ids.every((id) => page.data.some((context) => context.messageId === id));
    } catch (failure: unknown) {
      if (signal.aborted || this.disposed || this.snapshot.unavailable) return false;
      if (failure instanceof ApiRequestError && failure.status === 404) await this.revoke();
      else
        this.publish({
          contextError: 'Couldn’t refresh message details. Try refreshing the conversation.',
        });
      return false;
    }
  }
  syncInteractions(): Promise<void> {
    if (
      !this.enabled ||
      this.disposed ||
      this.snapshot.unavailable ||
      !this.snapshot.capabilities.reactions
    )
      return Promise.resolve();
    if (this.interactionSync !== null) {
      this.interactionsDirty = true;
      return this.interactionSync;
    }
    this.interactionsDirty = false;
    this.interactionSync = this.synchronizeInteractions().finally(() => {
      this.interactionSync = null;
      if (this.interactionsDirty && this.enabled && !this.disposed) void this.syncInteractions();
    });
    return this.interactionSync;
  }
  private async synchronizeInteractions() {
    const request = new AbortController();
    this.controllers.add(request);
    try {
      if (this.interactionCursor === null) {
        const covered = new Set<string>();
        let baseline: number | null = null;
        // Keep the FIRST atomic watermark: later batches/ACKs must not skip earlier changes.
        // New messages accepted while building the baseline are included before publishing its cursor.
        for (;;) {
          const ids = this.messages
            .filter((message) => !covered.has(message.id))
            .slice(0, 50)
            .map((message) => message.id);
          if (ids.length === 0) break;
          const page = await this.api.contexts(this.id, ids, request.signal);
          if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
          if (!ids.every((id) => page.data.some((context) => context.messageId === id)))
            throw new Error('Incomplete message context.');
          baseline ??= page.revision;
          await this.mergeContexts(page.data, request.signal);
          if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
          for (const id of ids) covered.add(id);
        }
        this.interactionCursor = baseline ?? 0;
      }
      for (let pageIndex = 0; pageIndex < 4; pageIndex++) {
        const cursor: number = this.interactionCursor;
        const page = await this.api.interactionChanges(this.id, cursor, request.signal);
        if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
        if (
          page.nextRevision < cursor ||
          page.nextRevision > page.latestRevision ||
          (page.nextRevision === cursor && page.latestRevision > cursor)
        )
          throw new Error('Invalid reaction cursor.');
        await this.mergeContexts(page.data, request.signal);
        if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
        this.interactionCursor = page.nextRevision;
        this.publish({ contextError: null });
        if (page.nextRevision === page.latestRevision) return;
      }
      this.interactionsDirty = true;
    } catch (failure: unknown) {
      if (request.signal.aborted || this.disposed || this.snapshot.unavailable) return;
      if (failure instanceof ApiRequestError && failure.status === 404) await this.revoke();
      else {
        if (failure instanceof ApiRequestError && failure.code === 'INVALID_CURSOR')
          this.interactionCursor = null;
        this.interactionsDirty = false;
        this.publish({
          contextError: 'Couldn’t sync reactions. Refresh the conversation to try again.',
        });
      }
    } finally {
      this.controllers.delete(request);
    }
  }
  async setReaction(messageId: string, reaction: ReactionKind) {
    if (
      !this.enabled ||
      !this.snapshot.capabilities.reactions ||
      this.disposed ||
      this.snapshot.unavailable ||
      this.reactionPending.has(messageId) ||
      this.reactionErrors.has(messageId)
    )
      return;
    const context = this.contexts.get(messageId);
    if (context === undefined || !this.messages.some((message) => message.id === messageId)) return;
    const current = context.reactions.find((state) => state.userId === this.ownerId);
    const request = new AbortController();
    this.controllers.add(request);
    this.reactionPending.add(messageId);
    this.publish();
    try {
      const result = await this.api.setReaction(
        this.id,
        messageId,
        {
          reaction: current?.reaction === reaction ? null : reaction,
          expectedRevision: current?.revision ?? 0,
        },
        request.signal,
      );
      if (this.disposed || this.snapshot.unavailable) return;
      // A mutation ACK updates only this row, never the durable replay cursor.
      await this.mergeContexts([result], request.signal);
      if (request.signal.aborted) throw new Error('Reaction outcome unknown.');
    } catch (failure: unknown) {
      if (this.disposed || this.snapshot.unavailable) return;
      if (failure instanceof ApiRequestError && failure.status === 404) await this.revoke();
      else
        this.reactionErrors.set(
          messageId,
          'Couldn’t confirm this reaction. Refresh it before trying again.',
        );
    } finally {
      this.controllers.delete(request);
      this.reactionPending.delete(messageId);
      this.publish();
    }
  }
  async refreshReaction(messageId: string) {
    if (
      !this.enabled ||
      this.disposed ||
      this.snapshot.unavailable ||
      this.reactionPending.has(messageId)
    )
      return;
    const request = new AbortController();
    this.controllers.add(request);
    this.reactionPending.add(messageId);
    this.publish();
    try {
      if (await this.refreshContexts([messageId], request.signal))
        this.reactionErrors.delete(messageId);
    } finally {
      this.controllers.delete(request);
      this.reactionPending.delete(messageId);
      this.publish();
    }
  }
  async loadOlder() {
    if (
      this.olderCursor === null ||
      !this.enabled ||
      this.snapshot.loadingOlder ||
      this.disposed ||
      this.snapshot.unavailable
    )
      return;
    const request = new AbortController();
    this.controllers.add(request);
    this.publish({ loadingOlder: true });
    try {
      const page = await this.api.history(this.id, { cursor: this.olderCursor }, request.signal);
      if (this.disposed || this.snapshot.unavailable || request.signal.aborted) return;
      await this.accept(page.data);
      await this.refreshContexts(
        page.data.map((message) => message.id),
        request.signal,
      );
      if (this.disposed || this.snapshot.unavailable || request.signal.aborted) return;
      this.olderCursor = page.olderCursor;
      this.publish({ hasOlder: this.olderCursor !== null });
    } catch (failure: unknown) {
      if (failure instanceof ApiRequestError && failure.status === 404) await this.revoke();
      else if (!request.signal.aborted)
        this.publish({ error: 'We couldn’t load earlier messages. Try again.' });
    } finally {
      this.controllers.delete(request);
      this.publish({ loadingOlder: false });
    }
  }
  async revoke() {
    this.enabled = false;
    clearTimeout(this.retryTimer);
    for (const request of this.controllers) request.abort();
    this.messages = [];
    this.outgoing = [];
    this.contexts.clear();
    this.reactionPending.clear();
    this.reactionErrors.clear();
    this.interactionCursor = null;
    this.statuses.clear();
    this.olderCursor = null;
    this.watermark = null;
    this.publish({
      unavailable: true,
      conversation: null,
      error: null,
      online: false,
      loading: false,
      hasOlder: false,
      loadingOlder: false,
      replyTo: null,
      contextError: null,
      capabilities: { replies: false, reactions: false },
    });
    try {
      await this.storage.clear(this.id);
    } catch {
      this.publish({
        error:
          'This conversation is closed, but its local cache could not be cleared. Please sign out to clear device data.',
      });
    }
    this.changed();
  }
  dispose() {
    this.disposed = true;
    this.enabled = false;
    clearTimeout(this.retryTimer);
    for (const request of this.controllers) request.abort();
    this.listeners.clear();
  }
}
