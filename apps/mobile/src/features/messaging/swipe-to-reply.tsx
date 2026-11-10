import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Reply from 'lucide-react-native/icons/reply';
import { colors } from '../../theme/tokens';
import { triggerFeedback } from '../../theme/feedback';

/**
 * Gesture Handler 3 no longer hides inactive swipe actions (2.x set opacity 0 until a swipe
 * began). Rows are transparent beside right-aligned bubbles, so the icon must derive its own
 * visibility from swipe progress or it shows beside every outgoing message.
 */
export function replyActionStyle(progress: number) {
  'worklet';
  const shown = Math.min(Math.max(progress, 0), 1);
  return { opacity: shown, transform: [{ scale: 0.6 + 0.4 * shown }] };
}

function ReplyAction({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => replyActionStyle(progress.value));
  return (
    <Animated.View
      testID="swipe-reply-action"
      style={[styles.action, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Reply size={20} color={colors.plum} strokeWidth={2} />
    </Animated.View>
  );
}
const renderReplyAction = (progress: SharedValue<number>) => <ReplyAction progress={progress} />;
export function SwipeToReply({
  messageId,
  onReply,
  reducedMotion,
  children,
}: {
  messageId: string;
  onReply: (id: string) => void;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const ref = useRef<SwipeableMethods>(null);
  useEffect(() => {
    ref.current?.reset();
  }, [messageId]);
  // Reset avoids carrying swipe state into a recycled list cell.
  // Source: https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated_swipeable/
  return (
    <Swipeable
      ref={ref}
      friction={2}
      leftThreshold={44}
      dragOffsetFromLeft={24}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderReplyAction}
      onSwipeableOpen={() => {
        onReply(messageId);
        if (!reducedMotion) triggerFeedback('selection');
        if (reducedMotion) ref.current?.reset();
        else ref.current?.close();
      }}
    >
      {children}
    </Swipeable>
  );
}
const styles = StyleSheet.create({
  action: { width: 56, justifyContent: 'center', alignItems: 'center' },
});
