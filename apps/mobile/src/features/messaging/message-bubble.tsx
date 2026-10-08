import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import type { ChatRow } from './chat-thread';

export const MessageBubble = memo(function MessageBubble({
  row,
  mine,
  retry,
  remove,
}: {
  row: ChatRow;
  mine: boolean;
  retry: (id: string) => void;
  remove: (id: string) => void;
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
  return (
    <View style={[styles.row, mine ? styles.right : styles.left]}>
      <View style={[styles.bubble, mine ? styles.outgoing : styles.incoming]}>
        <AppText style={mine ? styles.light : undefined}>{row.body}</AppText>
        <AppText variant="caption" style={[styles.meta, mine && styles.light]}>
          {time}
          {mine ? ` · ${state}` : ''}
        </AppText>
      </View>
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
  meta: { opacity: 0.8, marginTop: 4, fontSize: 11 },
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
