import { useState, type ComponentProps } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useReducedMotionPreference } from '../theme/motion';
import { duration } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<ComponentProps<typeof Pressable>, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Extra style while a finger is down. */
  pressedStyle?: StyleProp<ViewStyle>;
}

/**
 * A round or icon control that gives under the finger. Feedback starts on press-in, not on
 * release, and runs as a UI-thread transition so a busy JS thread cannot delay it.
 */
export function PressableScale({
  style,
  pressedStyle,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: PressableScaleProps) {
  const reduced = useReducedMotionPreference();
  const [pressed, setPressed] = useState(false);
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        style,
        pressed && disabled !== true && pressedStyle,
        {
          transform: [{ scale: pressed && disabled !== true && !reduced ? 0.94 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: duration.press,
          transitionTimingFunction: 'ease-out',
        },
      ]}
    />
  );
}
