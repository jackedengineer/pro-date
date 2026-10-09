import { describe, expect, it, vi } from 'vitest';
import { createNotificationWorker } from '../src/notifications/notification-worker.js';
import type { NotificationAttempt, NotificationReceiptWork } from '@pro-date/database';

const attempt: NotificationAttempt = {
  jobId: 'job',
  claimId: 'claim',
  attemptId: 'attempt',
  attemptNumber: 1,
  deviceId: 'device',
  deviceGeneration: 2,
  token: 'private-device-token',
  expiresAt: new Date(86400000),
  createdAt: new Date(0),
  payload: {
    version: 1,
    type: 'CHAT_MESSAGE',
    conversationId: 'conversation',
    messageId: 'message',
    recipientId: 'owner',
  },
};
const receipt: NotificationReceiptWork = {
  attemptId: 'attempt',
  ticketId: 'ticket',
  deviceId: 'device',
  deviceGeneration: 2,
  leaseUntil: new Date(60_000),
  expiresAt: new Date(86400000),
};
function setup(enabled = true) {
  let at = 1000;
  const jobs = {
    claim: vi.fn().mockResolvedValue([{ id: 'job', claimId: 'claim' }]),
    prepare: vi.fn().mockResolvedValue(attempt),
    authorize: vi.fn().mockResolvedValue(true),
    finish: vi.fn().mockResolvedValue(undefined),
    retire: vi.fn().mockResolvedValue(undefined),
    housekeep: vi.fn().mockResolvedValue(undefined),
  };
  const receipts = {
    claim: vi.fn().mockResolvedValue([]),
    finish: vi.fn().mockResolvedValue(undefined),
    expire: vi.fn().mockResolvedValue(undefined),
  };
  const provider = {
    send: vi.fn().mockResolvedValue({ kind: 'ACCEPTED', ticketId: 'ticket' }),
    receipt: vi.fn().mockResolvedValue({ kind: 'OK' }),
  };
  const observe = vi.fn();
  const worker = createNotificationWorker({
    jobs,
    receipts,
    provider: enabled ? provider : null,
    observe,
    now: () => at,
    random: () => 0.5,
  });
  return {
    jobs,
    receipts,
    provider,
    worker,
    observe,
    advance: (ms: number) => {
      at += ms;
    },
  };
}
describe('notification worker (fake repository/provider)', () => {
  it('does housekeeping but never claims/sends/reads receipts when live sending is off', async () => {
    const test = setup(false);
    await test.worker.runOnce();
    expect(test.jobs.housekeep).toHaveBeenCalledTimes(1);
    expect(test.receipts.expire).toHaveBeenCalledTimes(1);
    expect(test.jobs.claim).not.toHaveBeenCalled();
    expect(test.provider.send).not.toHaveBeenCalled();
  });
  it('records intent and rechecks eligibility before generic provider handoff', async () => {
    const test = setup();
    test.provider.send.mockImplementation(() => {
      expect(test.jobs.prepare).toHaveBeenCalled();
      expect(test.jobs.authorize).toHaveBeenCalledWith(attempt);
      return Promise.resolve({ kind: 'ACCEPTED', ticketId: 'ticket' });
    });
    await test.worker.runOnce();
    expect(test.jobs.finish).toHaveBeenCalledWith(
      attempt,
      expect.objectContaining({ outcome: 'ACCEPTED', ticketId: 'ticket' }),
    );
    expect(JSON.stringify(test.observe.mock.calls)).not.toMatch(
      /private-device-token|conversation|owner/,
    );
  });
  it('never sends a revoked, expired or stale claim', async () => {
    const test = setup();
    test.jobs.authorize.mockResolvedValue(false);
    await test.worker.runOnce();
    expect(test.provider.send).not.toHaveBeenCalled();
    test.jobs.prepare.mockResolvedValue(null);
    await test.worker.runOnce();
    expect(test.provider.send).not.toHaveBeenCalled();
  });
  it('persists unknown outcomes with backoff instead of calling the provider repeatedly', async () => {
    const test = setup();
    test.provider.send.mockResolvedValue({ kind: 'UNKNOWN', code: 'NETWORK' });
    await test.worker.runOnce();
    expect(test.provider.send).toHaveBeenCalledTimes(1);
    expect(test.jobs.finish).toHaveBeenCalledWith(
      attempt,
      expect.objectContaining({ outcome: 'UNKNOWN', nextAttemptAt: new Date(6000) }),
    );
  });
  it('pauses handoffs on bad credentials without stopping housekeeping', async () => {
    const test = setup();
    test.provider.send.mockResolvedValue({ kind: 'FAILED', code: 'CONFIGURATION' });
    await test.worker.runOnce();
    await test.worker.runOnce();
    expect(test.provider.send).toHaveBeenCalledTimes(1);
    expect(test.jobs.finish).toHaveBeenCalledWith(
      attempt,
      expect.objectContaining({
        outcome: 'RETRYABLE',
        errorCode: 'CONFIGURATION',
        nextAttemptAt: new Date(301000),
      }),
    );
    expect(test.jobs.housekeep).toHaveBeenCalledTimes(2);
    test.advance(300_000);
    await test.worker.runOnce();
    expect(test.provider.send).toHaveBeenCalledTimes(2);
  });
  it('retires only the attempted token generation after DeviceNotRegistered', async () => {
    const test = setup();
    test.provider.send.mockResolvedValue({ kind: 'FAILED', code: 'INVALID_DEVICE' });
    await test.worker.runOnce();
    expect(test.jobs.retire).toHaveBeenCalledWith('device', 2);
  });
  it('checks old accepted receipts independently of later mute, never resending missing receipts', async () => {
    const test = setup();
    test.jobs.claim.mockResolvedValue([]);
    test.receipts.claim.mockResolvedValue([receipt]);
    test.provider.receipt.mockResolvedValue({ kind: 'PENDING' });
    await test.worker.runOnce();
    expect(test.receipts.finish).toHaveBeenCalledWith(receipt, 'PENDING', null);
    expect(test.provider.send).not.toHaveBeenCalled();
    test.provider.receipt.mockResolvedValue({ kind: 'ERROR', code: 'INVALID_DEVICE' });
    await test.worker.runOnce();
    expect(test.jobs.retire).toHaveBeenCalledWith('device', 2);
  });
  it('isolates a repository/provider failure and stops new work on shutdown', async () => {
    const test = setup();
    test.jobs.prepare.mockRejectedValue(new Error('private SQL and token data'));
    await expect(test.worker.runOnce()).resolves.toBeUndefined();
    expect(JSON.stringify(test.observe.mock.calls)).not.toContain('private SQL');
    await test.worker.close();
    await test.worker.runOnce();
    expect(test.jobs.claim).toHaveBeenCalledTimes(1);
  });
});
