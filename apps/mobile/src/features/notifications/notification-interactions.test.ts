import { createNotificationInteractions } from './notification-interactions';
import type { MessagingRuntime } from '../messaging/messaging-provider';

const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const conversationId = '10000000-0000-4000-8000-000000000003';
const payload = {
  version: 1,
  type: 'CHAT_MESSAGE',
  conversationId,
  messageId: other,
  recipientId: owner,
};
function setup() {
  const settings = jest
    .fn<
      Promise<{ isAvailable: boolean; isDeliveryReady: boolean; isPaused: boolean }>,
      [AbortSignal?]
    >()
    .mockResolvedValue({ isAvailable: true, isDeliveryReady: true, isPaused: false });
  const preference = jest.fn().mockResolvedValue({ isEnabled: true });
  const conversation = jest.fn().mockResolvedValue({ id: conversationId });
  const runtime = {
    ownerId: owner,
    isCurrent: () => true,
    notifications: { settings, conversation: preference },
    api: { conversation },
  } as unknown as MessagingRuntime;
  let current: MessagingRuntime | null = runtime;
  let active: string | null = null;
  const openConversation = jest.fn();
  const openInbox = jest.fn();
  const controller = createNotificationInteractions({
    getRuntime: () => current,
    getActiveConversation: () => active,
    isForeground: () => true,
    openConversation,
    openInbox,
  });
  return {
    controller,
    runtime,
    settings,
    preference,
    conversation,
    openConversation,
    openInbox,
    setRuntime: (value: MessagingRuntime | null) => {
      current = value;
      controller.refresh();
    },
    setActive: (value: string | null) => {
      active = value;
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('private notification presentation and navigation', () => {
  it('suppresses wrong-owner/unknown payloads and the currently visible chat without fetching', async () => {
    const test = setup();
    expect(await test.controller.foreground({ ...payload, recipientId: other })).toBe(false);
    expect(await test.controller.foreground({ ...payload, url: 'https://attacker.test' })).toBe(
      false,
    );
    test.setActive(conversationId);
    expect(await test.controller.foreground(payload)).toBe(false);
    expect(test.settings).not.toHaveBeenCalled();
  });
  it('shows only currently enabled, unpaused other-chat alerts after fresh authorized reads', async () => {
    const test = setup();
    expect(await test.controller.foreground(payload)).toBe(true);
    test.settings.mockResolvedValue({ isAvailable: true, isDeliveryReady: true, isPaused: true });
    expect(await test.controller.foreground(payload)).toBe(false);
    test.settings.mockRejectedValue(new Error('Offline'));
    expect(await test.controller.foreground(payload)).toBe(false);
  });
  it('suppresses if the active chat changes while the policy lookup is in flight', async () => {
    const test = setup();
    test.preference.mockImplementation(() => {
      test.setActive(conversationId);
      return Promise.resolve({ isEnabled: true });
    });
    expect(await test.controller.foreground(payload)).toBe(false);
  });
  it('queues a cold tap until authenticated runtime, verifies REST access and opens once', async () => {
    const test = setup();
    test.setRuntime(null);
    test.controller.receive(payload);
    test.controller.receive(payload);
    expect(test.openConversation).not.toHaveBeenCalled();
    test.setRuntime(test.runtime);
    await flush();
    expect(test.conversation).toHaveBeenCalledWith(conversationId, expect.any(AbortSignal));
    expect(test.openConversation).toHaveBeenCalledTimes(1);
    expect(test.openConversation).toHaveBeenCalledWith(conversationId);
  });
  it('rejects a cold tap after switching into a different account', async () => {
    const test = setup();
    test.setRuntime(null);
    test.controller.receive(payload);
    test.setRuntime({ ...test.runtime, ownerId: other } as MessagingRuntime);
    await flush();
    expect(test.conversation).not.toHaveBeenCalled();
    expect(test.openConversation).not.toHaveBeenCalled();
  });
  it('does not navigate after an account switch or a newer tap interrupts authorization', async () => {
    const test = setup();
    let complete: (() => void) | undefined;
    test.conversation.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    test.controller.receive(payload);
    test.setRuntime(null);
    complete!();
    await flush();
    expect(test.openConversation).not.toHaveBeenCalled();
    expect(test.openInbox).not.toHaveBeenCalled();
  });
  it('fails safely to Merged for stale or unavailable conversations, never a supplied URL', async () => {
    const test = setup();
    test.conversation.mockRejectedValue(new Error('Unavailable'));
    test.controller.receive(payload);
    await flush();
    expect(test.openInbox).toHaveBeenCalledTimes(1);
    expect(test.openConversation).not.toHaveBeenCalled();
    test.controller.receive({ ...payload, url: '/messages/private' });
    await flush();
    expect(test.openInbox).toHaveBeenCalledTimes(1);
  });
  it('bounds foreground lookups to the native presentation deadline and aborts the request', async () => {
    jest.useFakeTimers();
    try {
      const test = setup();
      test.settings.mockImplementation(() => new Promise(() => {}));
      const result = test.controller.foreground(payload);
      await jest.advanceTimersByTimeAsync(2000);
      expect(await result).toBe(false);
      expect((test.settings.mock.calls[0]![0] as AbortSignal).aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
