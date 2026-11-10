// A render-only stand-in for Reanimated: components render, animations resolve to their end
// state. Tests that need more (shared-value writes, gestures) mock the module themselves.
import { Pressable, ScrollView, Text, View } from 'react-native';

type Chain = Record<string, (...args: unknown[]) => Chain>;
const chain = (): Chain =>
  new Proxy({}, { get: (_target, _key, receiver: Chain) => () => receiver });

const identity = <T,>(value: T) => value;
const Animated = { View, Text, ScrollView, createAnimatedComponent: identity };

export default Animated;
export const createAnimatedComponent = identity;
export const FadeIn = chain();
export const FadeInDown = chain();
export const FadeOut = chain();
export const LinearTransition = chain();
export const Easing = { bezier: () => identity, out: identity, inOut: identity };
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' };
export const useReducedMotion = () => false;
export const useAnimatedStyle = (factory: () => object) => factory();
export const useSharedValue = <T,>(initial: T) => ({
  value: initial,
  get: () => initial,
  set: () => {},
});
export const withTiming = identity;
export const withSpring = identity;
export const withDelay = (_delay: number, value: unknown) => value;
export { Pressable as AnimatedPressable };
