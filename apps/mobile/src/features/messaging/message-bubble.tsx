import { memo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import type { ChatRow } from './chat-thread';
import { QuotedMessage } from './message-quote';
import { SwipeToReply } from './swipe-to-reply';
import { MessageReactions } from './message-reactions';
import type { ReactionKind } from '@pro-date/contracts';
import type { MessageAnchor } from './reaction-picker-layout';

export const MessageBubble = memo(function MessageBubble({
  row,
  mine,
  retry,
  remove,
  reply,
  reducedMotion,
  ownerId,
  online,
  actions,
  react,
  refreshReaction,
}: {
  row: ChatRow;
  mine: boolean;
  retry: (id: string) => void;
  remove: (id: string) => void;
  reply: ((id: string) => void) | null;
  reducedMotion: boolean;
  ownerId: string;
  online: boolean;
  actions: ((id: string, anchor?: MessageAnchor) => void) | null;
  react: ((id: string, kind: ReactionKind) => void) | null;
  refreshReaction: (id: string) => void;
}) {
  const bubble = useRef<View>(null);
  const openActions = () => {
    if (row.messageId === null) return;
    const messageId = row.messageId;
    if (actions === null) {
      reply?.(messageId);
      return;
    }
    if (bubble.current === null) {
      actions(messageId);
      return;
    }
    // Measure only on intent, never on every recycled list row/layout pass.
    // https://reactnative.dev/docs/0.86/the-new-architecture/layout-measurements#measureinwindowcallback
    bubble.current.measureInWindow((x, y, width, height) => {
      actions(messageId, width > 0 && height > 0 ? { x, y, width, height } : undefined);
    });
  };
  const time = new Date(row.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const state =
    row.status === 'sent'
      ? 'Sent'
      : row.status === 'saving'
        ? 'Saving…'
        : row.status === 'sending'
          ? 'Sending…'
          : row.status === 'failed'
            ? 'Not sent'
            : 'Queued';
  const content = (
    <View style={[styles.row, mine ? styles.right : styles.left]}>
      <Pressable
        ref={bubble}
        style={[styles.bubble, mine ? styles.outgoing : styles.incoming]}
        accessible
        accessibilityActions={[
          ...(reply === null || row.messageId === null ? [] : [{ name: 'reply', label: 'Reply' }]),
          ...(actions === null || row.messageId === null
            ? []
            : [{ name: 'react', label: 'React to message' }]),
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'reply' && row.messageId !== null)
            reply?.(row.messageId);
          if (event.nativeEvent.actionName === 'react' && row.messageId !== null)
            actions?.(row.messageId);
        }}
        onLongPress={
          row.messageId !== null && (actions !== null || reply !== null) ? openActions : undefined
        }
        accessibilityHint={
          row.messageId === null
            ? undefined
            : actions !== null
              ? 'Long press for reactions and message actions'
              : reply === null
                ? undefined
                : 'Swipe right or long press to reply'
        }
      >
        {row.replyTo === null ? null : <QuotedMessage quote={row.replyTo} light={mine} />}
        <AppText style={mine ? styles.light : undefined}>{row.body}</AppText>
        <AppText variant="caption" style={[styles.meta, mine && styles.light]}>
          {time}
          {mine ? ` · ${state}` : ''}
        </AppText>
      </Pressable>
      <MessageReactions
        row={row}
        ownerId={ownerId}
        online={online}
        react={react}
        refresh={refreshReaction}
      />
      {mine && row.status === 'failed' ? (
        <View style={styles.failure}>
          <AppText variant="caption" style={styles.error}>
            {row.failure}
          </AppText>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry message"
              onPress={() => retry(row.clientId)}
              style={styles.action}
            >
              <AppText variant="caption">Retry</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove unsent message"
              onPress={() => remove(row.clientId)}
              style={styles.action}
            >
              <AppText variant="caption">Remove</AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
  return reply !== null && row.messageId !== null ? (
    <SwipeToReply messageId={row.messageId} onReply={reply} reducedMotion={reducedMotion}>
      {content}
    </SwipeToReply>
  ) : (
    content
  );
});
const styles = StyleSheet.create({
  row: { marginHorizontal: 16, marginVertical: 4 },
  right: { alignItems: 'flex-end' },
  left: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 20,
  },
  incoming: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outgoing: { backgroundColor: colors.plum, borderBottomRightRadius: 6 },
  light: { color: colors.white },
  meta: { marginTop: 6, fontSize: 13, color: colors.muted },
  failure: { maxWidth: '86%' },
  error: { color: colors.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: {
    minHeight: 44,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
