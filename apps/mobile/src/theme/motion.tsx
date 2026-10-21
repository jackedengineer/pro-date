import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo } from 'react-native';

const MotionContext = createContext(true);

export interface MotionSource {
  isReduceMotionEnabled: () => Promise<boolean>;
  addEventListener: (
    event: 'reduceMotionChanged',
    listener: (value: boolean) => void,
  ) => { remove: () => void };
}

// One listener for the app, rather than a system subscription on every button.
// https://reactnative.dev/docs/0.86/accessibilityinfo#addeventlistener
export function MotionProvider({
  children,
  source = AccessibilityInfo,
}: PropsWithChildren<{ source?: MotionSource }>) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = source.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      if (active) setReduced(value);
    });
    void source
      .isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduced(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, [source]);
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}

export function useReducedMotionPreference(): boolean {
  return useContext(MotionContext);
}
