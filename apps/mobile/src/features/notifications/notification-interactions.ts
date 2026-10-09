import { chatNotificationPayloadSchema, type ChatNotificationPayload } from '@pro-date/contracts';
import type { MessagingRuntime } from '../messaging/messaging-provider';

interface Ports {
  getRuntime: () => MessagingRuntime | null;
  getActiveConversation: () => string | null;
  isForeground: () => boolean;
  openConversation: (id: string) => void;
  openInbox: () => void;
  now?: () => number;
}
async function bounded<T>(
  controller: AbortController,
  ms: number,
  run: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Notification lookup timed out'));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

/** Notification data is untrusted routing metadata, never an access grant or a URL. */
export function createNotificationInteractions(ports: Ports) {
  const now = ports.now ?? Date.now;
  const seen = new Set<string>();
  let pending: { payload: ChatNotificationPayload; expiresAt: number } | null = null;
  let flight: { runtime: MessagingRuntime; controller: AbortController } | null = null;
  let revision = 0;
  let closed = false;
  const current = (runtime: MessagingRuntime) =>
    !closed && ports.getRuntime() === runtime && runtime.isCurrent();
  async function navigate(
    runtime: MessagingRuntime,
    payload: ChatNotificationPayload,
    version: number,
  ) {
    const controller = new AbortController();
    flight = { runtime, controller };
    try {
      await bounded(controller, 8000, () =>
        runtime.api.conversation(payload.conversationId, controller.signal),
      );
      if (current(runtime) && revision === version) ports.openConversation(payload.conversationId);
    } catch {
      if (current(runtime) && revision === version) ports.openInbox();
    } finally {
      if (flight?.controller === controller) flight = null;
    }
  }
  const refresh = () => {
    const runtime = ports.getRuntime();
    if (flight !== null && (runtime !== flight.runtime || !current(flight.runtime))) {
      revision++;
      flight.controller.abort();
      flight = null;
    }
    if (closed || runtime === null || !current(runtime) || pending === null) return;
    const next = pending;
    pending = null;
    if (next.expiresAt <= now() || next.payload.recipientId !== runtime.ownerId) return;
    void navigate(runtime, next.payload, revision);
  };
  return {
    async foreground(data: unknown): Promise<boolean> {
      const parsed = chatNotificationPayloadSchema.safeParse(data);
      const runtime = ports.getRuntime();
      if (
        !parsed.success ||
        runtime === null ||
        !current(runtime) ||
        !ports.isForeground() ||
        parsed.data.recipientId !== runtime.ownerId ||
        ports.getActiveConversation() === parsed.data.conversationId
      )
        return false;
      const controller = new AbortController();
      try {
        const [settings, preference] = await bounded(controller, 2000, () =>
          Promise.all([
            runtime.notifications.settings(controller.signal),
            runtime.notifications.conversation(parsed.data.conversationId, controller.signal),
          ]),
        );
        return (
          current(runtime) &&
          ports.isForeground() &&
          ports.getActiveConversation() !== parsed.data.conversationId &&
          settings.isAvailable &&
          settings.isDeliveryReady &&
          !settings.isPaused &&
          preference.isEnabled
        );
      } catch {
        return false;
      }
    },
    receive(data: unknown) {
      if (closed) return;
      const parsed = chatNotificationPayloadSchema.safeParse(data);
      if (!parsed.success) return;
      const key = `${parsed.data.recipientId}:${parsed.data.messageId}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (seen.size > 128) seen.delete(seen.values().next().value!);
      revision++;
      flight?.controller.abort();
      flight = null;
      pending = { payload: parsed.data, expiresAt: now() + 300_000 };
      refresh();
    },
    refresh,
    dispose() {
      closed = true;
      revision++;
      pending = null;
      flight?.controller.abort();
      flight = null;
    },
  };
}
