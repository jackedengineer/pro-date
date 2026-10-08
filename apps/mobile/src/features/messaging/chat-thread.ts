import { messageBodySchema, type Conversation, type Message } from '@pro-date/contracts';
import { ApiRequestError } from '../../api/http-client';
import type { MessagingApi } from '../../api/messaging';
import type { ChatStorage, OutgoingMessage } from './chat-storage';

export type ChatRow = Omit<Message, 'id' | 'sequence'> & {
  key: string;
  sequence: number | null;
  status: 'saving' | 'queued' | 'sending' | 'sent' | 'failed';
  failure: string | null;
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
}
export class ChatThread {
  private messages: Message[] = [];
  private outgoing: OutgoingMessage[] = [];
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
        if (this.disposed) return;
        this.messages = cached.messages;
        this.outgoing = cached.outgoing;
        this.publish({ conversation: cached.conversation, loading: false });
      })
      .catch(() => {
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
    }));
    for (const pending of this.outgoing)
      if (!confirmed.has(`${this.ownerId}:${pending.clientId}`))
        rows.push({
          ...pending,
          senderId: this.ownerId,
          key: `${this.ownerId}:${pending.clientId}`,
          sequence: null,
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
    this.publish();
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
          { clientId: pending.clientId, body: pending.body },
          request.signal,
        );
        // An ACK may leap over an incoming message: only REST history advances the sync watermark.
        await this.accept([message]);
        this.statuses.delete(pending.clientId);
        this.attempts = 0;
      } catch (failure: unknown) {
        this.statuses.delete(pending.clientId);
        if (this.disposed) return;
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
      if (this.disposed) return;
      await this.storage.saveConversation(conversation);
      this.publish({ conversation });
      do {
        const baseline = this.watermark === null;
        const page = await this.api.history(
          this.id,
          baseline ? {} : { afterSequence: this.watermark! },
          request.signal,
        );
        if (this.disposed) return;
        // A fresh latest page resets a truncated cached window so its older cursor cannot skip gaps.
        if (baseline)
          this.messages = this.messages.filter((message) => message.sequence > page.latestSequence);
        await this.accept(page.data);
        this.watermark = page.nextAfterSequence ?? page.latestSequence;
        if (baseline) {
          this.olderCursor = page.olderCursor;
          this.publish({ hasOlder: this.olderCursor !== null });
        }
        if (page.nextAfterSequence === null) break;
      } while (this.enabled && !this.disposed);
    } catch (failure: unknown) {
      if (this.disposed) return;
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
  async loadOlder() {
    if (this.olderCursor === null || !this.enabled || this.snapshot.loadingOlder || this.disposed)
      return;
    const request = new AbortController();
    this.controllers.add(request);
    this.publish({ loadingOlder: true });
    try {
      const page = await this.api.history(this.id, { cursor: this.olderCursor }, request.signal);
      await this.accept(page.data);
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
    this.publish({ unavailable: true, conversation: null, error: null, online: false });
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
