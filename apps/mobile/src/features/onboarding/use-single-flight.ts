import { useCallback, useRef } from 'react';

/**
 * Shares one in-flight run of `task` across repeated calls. Taps can be delivered before React
 * re-renders and hides a button (especially while the JS thread is busy), so a Retry button
 * otherwise sends one identical request per tap.
 */
export function useSingleFlight(task: () => Promise<void>): () => Promise<void> {
  const inFlight = useRef<Promise<void> | null>(null);

  return useCallback(() => {
    inFlight.current ??= task().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, [task]);
}
