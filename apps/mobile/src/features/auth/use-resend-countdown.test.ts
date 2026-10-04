import { act, renderHook } from '@testing-library/react-native';

import { useResendCountdown } from './use-resend-countdown';

describe('useResendCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts down once per second and can restart after another code is sent', async () => {
    const hook = await renderHook(() => useResendCountdown(2));

    expect(hook.result.current.secondsRemaining).toBe(2);

    await act(() => jest.advanceTimersByTime(1_000));
    expect(hook.result.current.secondsRemaining).toBe(1);

    await act(() => jest.advanceTimersByTime(1_000));
    expect(hook.result.current.secondsRemaining).toBe(0);

    await act(() => hook.result.current.restart());
    expect(hook.result.current.secondsRemaining).toBe(2);
  });
});
