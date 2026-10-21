import type { ReactionKind } from '@pro-date/contracts';
import { useEffect, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import X from 'lucide-react-native/icons/x';
import Reply from 'lucide-react-native/icons/reply';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import { useReducedMotionPreference } from '../../theme/motion';
import type { ChatRow } from './chat-thread';
import { displayedReactions, reactionOptions } from './reaction-options';
import { reactionPickerPosition, type MessageAnchor } from './reaction-picker-layout';

export function ReactionPicker({
  row,
  ownerId,
  online,
  onClose,
  onReply,
  onReact,
  onRefresh,
  anchor = null,
  topInset = 0,
  bottomInset = 0,
  leftInset = 0,
  rightInset = 0,
}: {
  row: ChatRow | null;
  ownerId: string;
  online: boolean;
  onClose: () => void;
  onReply: ((id: string) => void) | null;
  onReact: (id: string, kind: ReactionKind) => void;
  onRefresh: (id: string) => void;
  anchor?: MessageAnchor | null;
  topInset?: number;
  bottomInset?: number;
  leftInset?: number;
  rightInset?: number;
}) {
  const window = useWindowDimensions();
  const reducedMotion = useReducedMotionPreference();
  const [entrance] = useState(() => new Animated.Value(1));
  const [menuHeight, setMenuHeight] = useState(104);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(
    () => Keyboard.metrics()?.screenY ?? null,
  );
  const messageId = row?.messageId ?? null;
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardTop(event.endCoordinates.screenY),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    entrance.stopAnimation();
    entrance.setValue(reducedMotion || messageId === null ? 1 : 0);
    if (messageId === null || reducedMotion) return;
    // Native opacity/transform only: no layout animation on the message list.
    // https://reactnative.dev/docs/0.86/animated#using-the-native-driver
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [messageId, reducedMotion, entrance]);
  const own =
    row === null
      ? null
      : (displayedReactions(row, ownerId).find((state) => state.userId === ownerId)?.reaction ??
        null);
  const disabled =
    !online || row?.reactionPending === true || row?.reactionError != null || row?.context == null;
  const width = Math.min(280, window.width - leftInset - rightInset - 32);
  const availableHeight = Math.min(window.height, keyboardTop ?? window.height);
  const bottom = keyboardTop === null ? bottomInset : 0;
  const maxHeight = Math.max(52, availableHeight - topInset - bottom - 24);
  const position = reactionPickerPosition({
    anchor,
    width: window.width,
    height: availableHeight,
    menuWidth: width,
    menuHeight: Math.min(menuHeight, maxHeight),
    topInset,
    bottomInset: bottom,
    leftInset,
    rightInset,
  });
  return (
    <Modal
      visible={row !== null}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <Animated.View
          style={[
            styles.menu,
            position,
            {
              width,
              maxHeight,
              opacity: entrance,
              transform: [
                { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          onLayout={(event) => setMenuHeight(event.nativeEvent.layout.height)}
        >
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={[
              styles.content,
              anchor !== null && position.top < anchor.y && styles.above,
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.pill}
              contentContainerStyle={styles.choices}
              testID="reaction-picker-pill"
            >
              {reactionOptions.map((option) => (
                <Pressable
                  key={option.kind}
                  accessibilityRole="button"
                  accessibilityLabel={`${own === option.kind ? 'Remove' : 'Add'} ${option.label} reaction`}
                  accessibilityState={{ selected: own === option.kind, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    if (messageId !== null) onReact(messageId, option.kind);
                  }}
                  style={({ pressed }) => [
                    styles.choice,
                    disabled && styles.disabled,
                    pressed && styles.pressed,
                    pressed && !reducedMotion && styles.compressed,
                  ]}
                >
                  <View style={[styles.emojiDisc, own === option.kind && styles.selected]}>
                    <AppText style={styles.emoji} maxFontSizeMultiplier={1.2}>
                      {option.emoji}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            {!online ? (
              <AppText variant="caption" style={styles.notice}>
                Connect to change reactions. Replies can stay queued.
              </AppText>
            ) : null}
            {row?.reactionError == null ? null : (
              <AppText
                variant="caption"
                style={[styles.notice, styles.error]}
                accessibilityRole="alert"
              >
                {row.reactionError}
              </AppText>
            )}
            {row !== null && (row.reactionError !== null || row.context === null) ? (
              <Pressable
                accessibilityRole="button"
                disabled={!online || row.reactionPending}
                onPress={() => {
                  if (messageId !== null) onRefresh(messageId);
                }}
                style={styles.recovery}
              >
                <AppText variant="caption">Refresh reaction</AppText>
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              {onReply === null || messageId === null ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onReply(messageId)}
                  style={({ pressed }) => [styles.reply, pressed && styles.pressed]}
                >
                  <Reply size={16} color={colors.plum} strokeWidth={1.5} />
                  <AppText variant="caption" style={styles.replyText}>
                    Reply
                  </AppText>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close message actions"
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <X size={16} color={colors.muted} strokeWidth={1.5} />
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: `${colors.ink}1F` },
  menu: { position: 'absolute', gap: 8 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 8 },
  above: { flexDirection: 'column-reverse' },
  pill: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderRadius: 28,
    boxShadow: '0 3px 16px rgba(0, 0, 0, 0.12)',
  },
  choices: { flexDirection: 'row', flexWrap: 'nowrap', padding: 8, paddingVertical: 4 },
  choice: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emojiDisc: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  selected: { backgroundColor: colors.plumSoft },
  emoji: { fontSize: 24, lineHeight: 32 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  compressed: { transform: [{ scale: 0.96 }] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  reply: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyText: { color: colors.plum },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  notice: { padding: 12, backgroundColor: colors.surface, borderRadius: 12 },
  recovery: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
  },
  error: { color: colors.danger },
});
