import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import type { ChatRow } from './chat-thread';
import { QuotedMessage } from './message-quote';
import { SwipeToReply } from './swipe-to-reply';

export const MessageBubble = memo(function MessageBubble({
  row,
  mine,
  retry,
  remove,
  reply,
  reducedMotion,
}: {
  row: ChatRow;
  mine: boolean;
  retry: (id: string) => void;
  remove: (id: string) => void;
  reply: ((id: string) => void) | null;
  reducedMotion: boolean;
}) {
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
        style={[styles.bubble, mine ? styles.outgoing : styles.incoming]}
        accessible
        accessibilityActions={reply === null ? [] : [{ name: 'reply', label: 'Reply' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'reply' && row.messageId !== null)
            reply?.(row.messageId);
        }}
        onLongPress={
          reply !== null && row.messageId !== null ? () => reply(row.messageId!) : undefined
        }
        accessibilityHint={reply === null ? undefined : 'Swipe right or long press to reply'}
      >
        {row.replyTo === null ? null : <QuotedMessage quote={row.replyTo} light={mine} />}
        <AppText style={mine ? styles.light : undefined}>{row.body}</AppText>
        <AppText variant="caption" style={[styles.meta, mine && styles.light]}>
          {time}
          {mine ? ` · ${state}` : ''}
        </AppText>
      </Pressable>
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
