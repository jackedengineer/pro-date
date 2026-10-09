import { describe, expect, it } from 'vitest';
import { RealtimeAdmission } from '../src/messaging/realtime-admission.js';

describe('bounded realtime admission', () => {
  it('shares a replenishing budget across IPv4-mapped peers without trusting headers', () => {
    let now = 0;
    const policy = new RealtimeAdmission({ peerBurst: 2, peerRate: 2 }, () => now);
    expect(policy.admitPeer('::ffff:127.0.0.1')).toBeNull();
    expect(policy.admitPeer('127.0.0.1')).toBeNull();
    expect(policy.admitPeer('127.0.0.1')).toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterMs: 500,
    });
    now = 500;
    expect(policy.admitPeer('127.0.0.1')).toBeNull();
  });
  it('rejects new peers at memory capacity rather than resetting active budgets', () => {
    let now = 0;
    const policy = new RealtimeAdmission({ maxPeers: 1, peerBurst: 1, peerIdleMs: 60 }, () => now);
    expect(policy.admitPeer('first')).toBeNull();
    expect(policy.admitPeer('second')).toMatchObject({ code: 'SERVER_BUSY' });
    expect(policy.admitPeer('first')).toMatchObject({ code: 'RATE_LIMITED' });
    now = 61;
    expect(policy.admitPeer('second')).toBeNull();
  });
  it('keeps hung verification counted until its actual settlement, with idempotent release', () => {
    const policy = new RealtimeAdmission({ maxVerifications: 1 });
    const release = policy.reserveVerification();
    expect(typeof release).toBe('function');
    expect(policy.reserveVerification()).toBeNull();
    release?.();
    release?.();
    const next = policy.reserveVerification();
    expect(typeof next).toBe('function');
    expect(policy.reserveVerification()).toBeNull();
    next?.();
  });
  it('bounds account and total sockets and releases reservations exactly once', () => {
    const policy = new RealtimeAdmission({ maxAccountSockets: 1, maxSockets: 2 });
    const first = policy.reserveSocket('one');
    expect(typeof first).toBe('function');
    expect(policy.reserveSocket('one')).toBeNull();
    const second = policy.reserveSocket('two');
    expect(policy.reserveSocket('three')).toBeNull();
    first?.();
    first?.();
    const third = policy.reserveSocket('three');
    expect(typeof third).toBe('function');
    expect(policy.reserveSocket('four')).toBeNull();
    second?.();
    third?.();
    expect(policy.snapshot()).toMatchObject({ verifications: 0, sockets: 0, accounts: 0 });
  });
});
