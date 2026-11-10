import { useEffect, type PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { triggerFeedback } from '../../theme/feedback';
import { springs } from '../../theme/tokens';
import { photoDropTarget } from './photo-drop-target';

interface DraggablePhotoProps {
  index: number;
  count: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  gap: number;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Hold a photo, then drag it onto another to take its place. The hold keeps a normal scroll from
 * picking photos up by accident. The arrow buttons on each photo do the same job without a drag.
 */
export function DraggablePhoto({
  index,
  count,
  columns,
  cellWidth,
  cellHeight,
  gap,
  disabled,
  onMove,
  style,
  testID,
  children,
}: PropsWithChildren<DraggablePhotoProps>) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lifted = useSharedValue(false);

  // After a drop the photo re-renders in its new slot; the offset it was dragged by is spent.
  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [index, x, y]);

  const pan = Gesture.Pan()
    .enabled(!disabled && count > 1)
    .activateAfterLongPress(220)
    .onStart(() => {
      lifted.set(true);
      scheduleOnRN(triggerFeedback, 'selection');
    })
    .onUpdate((event) => {
      x.set(event.translationX);
      y.set(event.translationY);
    })
    .onEnd((event) => {
      const target = photoDropTarget({
        index,
        count,
        columns,
        cellWidth,
        cellHeight,
        gap,
        dx: event.translationX,
        dy: event.translationY,
      });
      if (target === index) {
        x.set(withSpring(0, springs.snap));
        y.set(withSpring(0, springs.snap));
        return;
      }
      scheduleOnRN(triggerFeedback, 'impact');
      scheduleOnRN(onMove, index, target);
    })
    .onFinalize(() => {
      lifted.set(false);
    });

  const animated = useAnimatedStyle(() => ({
    zIndex: lifted.get() ? 10 : 0,
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: withSpring(lifted.get() ? 1.04 : 1, springs.settle) },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, animated]} testID={testID}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
