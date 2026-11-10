// Gestures need a native runtime. In tests, detectors render their child and gestures are inert;
// what a gesture decides (for example where a dragged photo lands) is tested as plain logic.
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

type Chain = Record<string, (...args: unknown[]) => Chain>;
const chain = (): Chain =>
  new Proxy({}, { get: (_target, _key, receiver: Chain) => () => receiver });

export const Gesture = { Pan: chain, Tap: chain, LongPress: chain };
export const GestureDetector = ({ children }: PropsWithChildren) => children;
export const GestureHandlerRootView = View;
