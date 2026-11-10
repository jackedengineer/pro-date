import { act, renderHook } from '@testing-library/react-native';

import { useSingleFlight } from './use-single-flight';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

describe('useSingleFlight', () => {
  it('turns taps delivered before a re-render into one request', async () => {
    const pending = deferred();
    const task = jest.fn(() => pending.promise);
    const hook = await renderHook(() => useSingleFlight(task));

    let calls: Promise<void>[] = [];
    await act(() => {
      calls = [hook.result.current(), hook.result.current(), hook.result.current()];
    });
    expect(task).toHaveBeenCalledTimes(1);
    expect(new Set(calls).size).toBe(1);

    await act(async () => {
      pending.resolve();
      await Promise.all(calls);
    });
  });

  it('allows a new run once the previous one settles, including after a failure', async () => {
    const first = deferred();
    const task = jest
      .fn<Promise<void>, []>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(undefined);
    const hook = await renderHook(() => useSingleFlight(task));

    let failed: Promise<void> = Promise.resolve();
    await act(() => {
      failed = hook.result.current();
    });
    await act(async () => {
      first.reject(new Error('offline'));
      await expect(failed).rejects.toThrow('offline');
    });

    await act(() => hook.result.current());
    expect(task).toHaveBeenCalledTimes(2);
  });
});
