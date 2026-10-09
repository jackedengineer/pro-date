import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { RealtimeReconnect } from './realtime-reconnect';

afterEach(() => {
  jest.useRealTimers();
});
describe('bounded socket admission recovery', () => {
  it('does not automatically retry rejected credentials, but allows foreground recovery', () => {
    jest.useFakeTimers();
    const connect = jest.fn();
    const disconnect = jest.fn();
    const recovery = new RealtimeReconnect({ connect, disconnect, random: () => 0.5 });
    recovery.setAvailable(true);
    recovery.rejected({ data: { code: 'AUTH_REQUIRED' } }, false);
    jest.advanceTimersByTime(300_000);
    expect(connect).toHaveBeenCalledTimes(1);
    recovery.setAvailable(false);
    recovery.setAvailable(true);
    expect(connect).toHaveBeenCalledTimes(2);
    recovery.dispose();
  });
  it('honors server backoff, stops at eight failures and cancels background retries', () => {
    jest.useFakeTimers();
    const connect = jest.fn();
    const recovery = new RealtimeReconnect({ connect, disconnect: jest.fn(), random: () => 0.5 });
    recovery.setAvailable(true);
    recovery.rejected({ data: { code: 'SERVER_BUSY', retryAfterMs: 60_000 } }, false);
    jest.advanceTimersByTime(59_999);
    expect(connect).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(connect).toHaveBeenCalledTimes(2);
    for (let index = 1; index < 8; index += 1) {
      recovery.rejected({ data: { code: 'AUTH_TIMEOUT' } }, false);
      jest.advanceTimersByTime(60_000);
    }
    expect(connect).toHaveBeenCalledTimes(8);
    recovery.setAvailable(false);
    recovery.setAvailable(true);
    recovery.expired();
    recovery.setAvailable(false);
    jest.advanceTimersByTime(300_000);
    expect(connect).toHaveBeenCalledTimes(9);
    recovery.dispose();
  });
  it('leaves network transport recovery to Socket.IO and fails closed on unknown admission errors', () => {
    jest.useFakeTimers();
    const connect = jest.fn();
    const recovery = new RealtimeReconnect({ connect, disconnect: jest.fn() });
    recovery.setAvailable(true);
    recovery.rejected(new Error('network'), true);
    jest.advanceTimersByTime(300_000);
    expect(connect).toHaveBeenCalledTimes(1);
    recovery.rejected({ data: { code: 'SURPRISE', retryAfterMs: 1 } }, false);
    recovery.setAvailable(true);
    jest.advanceTimersByTime(300_000);
    expect(connect).toHaveBeenCalledTimes(1);
    recovery.dispose();
    recovery.setAvailable(true);
    recovery.expired();
    jest.advanceTimersByTime(300_000);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
