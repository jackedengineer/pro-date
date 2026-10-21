import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reply from 'lucide-react-native/icons/reply';
import { colors } from '../../theme/tokens';
import { triggerFeedback } from '../../theme/feedback';

function ReplyAction() {
  return (
    <View
      style={styles.action}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Reply size={20} color={colors.plum} strokeWidth={2} />
    </View>
  );
}
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
  // Gesture Handler 2.x API; reset avoids carrying swipe state into a recycled list cell.
  // Source: https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/components/reanimated_swipeable/
  return (
    <Swipeable
      ref={ref}
      friction={2}
      leftThreshold={44}
      dragOffsetFromLeftEdge={24}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={ReplyAction}
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
