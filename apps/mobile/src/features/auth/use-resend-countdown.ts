import { useCallback, useEffect, useState } from 'react';

export function useResendCountdown(initialSeconds: number) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (secondsRemaining === 0) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setSecondsRemaining((currentValue) => Math.max(0, currentValue - 1));
    }, 1_000);

    return () => clearTimeout(timeout);
  }, [secondsRemaining]);

  const restart = useCallback(() => {
    setSecondsRemaining(initialSeconds);
  }, [initialSeconds]);

  return { restart, secondsRemaining };
}
