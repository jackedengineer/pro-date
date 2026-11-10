import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { useReducedMotionPreference } from '../theme/motion';
import { easing } from '../theme/tokens';

/**
 * A first-impression entrance: content settles up into place, each block a beat after the last.
 * For screens seen rarely (welcome, a finished profile). Never for lists or repeat visits.
 */
export function Reveal({
  children,
  order = 0,
  style,
}: PropsWithChildren<{ order?: number; style?: StyleProp<ViewStyle> }>) {
  const reduced = useReducedMotionPreference();
  return (
    <Animated.View
      style={style}
      {...(reduced
        ? {}
        : {
            entering: FadeInDown.duration(420)
              .delay(order * 60)
              .easing(Easing.bezier(...easing.out))
              .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] }),
          })}
    >
      {children}
    </Animated.View>
  );
}
